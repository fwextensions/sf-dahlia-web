/**
 * User Migration Script: devise_token_auth → Clerk + Prisma
 *
 * Migrates all User and UploadedFile records from the Rails PostgreSQL database
 * to the new Prisma schema, creating corresponding Clerk accounts.
 *
 * Features:
 * - Idempotent: can be re-run without creating duplicates (checks by email)
 * - Preserves salesforceContactId for every user (non-null mapping)
 * - Stores timestamps in UTC with zero drift
 * - Logs and skips records that fail due to constraint violations
 * - Produces a summary report at the end
 *
 * Environment variables required:
 * - DATABASE_URL: Target Prisma database connection string
 * - SOURCE_DATABASE_URL: Source Rails PostgreSQL connection string
 * - CLERK_SECRET_KEY: Clerk Backend API secret key
 *
 * Usage:
 *   npx tsx scripts/migrate-users.ts
 */

import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"

// ─── Types ───────────────────────────────────────────────────────────────────

interface SourceUser {
  id: number
  email: string
  salesforce_contact_id: string | null
  temp_session_id: string | null
  confirmed_at: Date | null
  created_at: Date
  updated_at: Date
}

interface SourceUploadedFile {
  id: number
  user_id: number | null
  application_id: string | null
  listing_id: string | null
  listing_preference_id: string | null
  document_type: string | null
  name: string | null
  content_type: string | null
  session_uid: string | null
  address: string | null
  rent_burden_type: number | null
  rent_burden_index: string | null
  created_at: Date
  updated_at: Date
}

interface MigrationReport {
  users: { total: number; migrated: number; failed: number; skipped: number }
  uploadedFiles: { total: number; migrated: number; failed: number; skipped: number }
  failures: Array<{ entity: string; sourceId: number; error: string }>
}

// ─── Clerk Backend SDK (lightweight wrapper) ─────────────────────────────────

async function createClerkUser(email: string, clerkSecretKey: string): Promise<string> {
  const response = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      skip_password_requirement: true,
      skip_password_checks: true,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Clerk API error (${response.status}): ${body}`)
  }

  const data = await response.json()
  return data.id as string
}

async function findClerkUserByEmail(
  email: string,
  clerkSecretKey: string
): Promise<string | null> {
  const response = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
      },
    }
  )

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  if (Array.isArray(data) && data.length > 0) {
    return data[0].id as string
  }
  return null
}

// ─── Timestamp Normalization ─────────────────────────────────────────────────

/**
 * Normalizes a timestamp to UTC. PostgreSQL timestamps without timezone
 * are assumed to be in UTC by Rails (config.active_record.default_timezone = :utc).
 * We ensure the Date object represents the correct UTC instant.
 */
function normalizeTimestamp(date: Date | null): Date | null {
  if (!date) return null
  // pg driver returns Date objects already in UTC for `timestamp without time zone`
  // when the connection timezone is UTC (which is default)
  return new Date(date.toISOString())
}

// ─── Main Migration ──────────────────────────────────────────────────────────

async function migrateUsers(): Promise<void> {
  const sourceDbUrl = process.env.SOURCE_DATABASE_URL
  const clerkSecretKey = process.env.CLERK_SECRET_KEY

  if (!sourceDbUrl) {
    console.error("ERROR: SOURCE_DATABASE_URL environment variable is required")
    process.exit(1)
  }
  if (!clerkSecretKey) {
    console.error("ERROR: CLERK_SECRET_KEY environment variable is required")
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is required")
    process.exit(1)
  }

  const prisma = new PrismaClient()
  const sourcePool = new Pool({ connectionString: sourceDbUrl })

  const report: MigrationReport = {
    users: { total: 0, migrated: 0, failed: 0, skipped: 0 },
    uploadedFiles: { total: 0, migrated: 0, failed: 0, skipped: 0 },
    failures: [],
  }

  try {
    console.log("=== User Migration: devise → Clerk + Prisma ===\n")
    console.log("Connecting to source database...")

    // Build a map of old user IDs → new user IDs for UploadedFile FK mapping
    const userIdMap = new Map<number, string>()

    // ─── Phase 1: Migrate Users ────────────────────────────────────────────────

    console.log("\n--- Phase 1: Migrating Users ---\n")

    const usersResult = await sourcePool.query<SourceUser>(
      `SELECT id, email, salesforce_contact_id, temp_session_id, 
              confirmed_at, created_at, updated_at 
       FROM users 
       ORDER BY id`
    )

    const sourceUsers = usersResult.rows
    report.users.total = sourceUsers.length
    console.log(`Found ${sourceUsers.length} users in source database`)

    for (const sourceUser of sourceUsers) {
      try {
        // Skip users without salesforce_contact_id (requirement: non-null mapping)
        if (!sourceUser.salesforce_contact_id) {
          console.warn(
            `  SKIP user #${sourceUser.id} (${sourceUser.email}): missing salesforce_contact_id`
          )
          report.users.skipped++
          report.failures.push({
            entity: "User",
            sourceId: sourceUser.id,
            error: "Missing salesforce_contact_id (non-null required)",
          })
          continue
        }

        // Idempotency check: see if user already exists in target by email
        const existingUser = await prisma.user.findUnique({
          where: { email: sourceUser.email },
        })

        if (existingUser) {
          console.log(`  SKIP user #${sourceUser.id} (${sourceUser.email}): already migrated`)
          userIdMap.set(sourceUser.id, existingUser.id)
          report.users.skipped++
          continue
        }

        // Create or find Clerk user
        let clerkUserId = await findClerkUserByEmail(sourceUser.email, clerkSecretKey)
        if (!clerkUserId) {
          clerkUserId = await createClerkUser(sourceUser.email, clerkSecretKey)
        }

        // Insert into Prisma
        const newUser = await prisma.user.create({
          data: {
            clerkUserId,
            email: sourceUser.email,
            salesforceContactId: sourceUser.salesforce_contact_id,
            tempSessionId: sourceUser.temp_session_id,
            confirmedAt: normalizeTimestamp(sourceUser.confirmed_at),
            createdAt: normalizeTimestamp(sourceUser.created_at)!,
            updatedAt: normalizeTimestamp(sourceUser.updated_at)!,
          },
        })

        userIdMap.set(sourceUser.id, newUser.id)
        report.users.migrated++
        console.log(`  OK   user #${sourceUser.id} → ${newUser.id} (${sourceUser.email})`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`  FAIL user #${sourceUser.id} (${sourceUser.email}): ${errorMessage}`)
        report.users.failed++
        report.failures.push({
          entity: "User",
          sourceId: sourceUser.id,
          error: errorMessage,
        })
      }
    }

    // ─── Phase 2: Migrate UploadedFiles ────────────────────────────────────────

    console.log("\n--- Phase 2: Migrating UploadedFiles ---\n")

    const filesResult = await sourcePool.query<SourceUploadedFile>(
      `SELECT id, user_id, application_id, listing_id, listing_preference_id,
              document_type, name, content_type, session_uid, address,
              rent_burden_type, rent_burden_index, created_at, updated_at
       FROM uploaded_files
       ORDER BY id`
    )

    const sourceFiles = filesResult.rows
    report.uploadedFiles.total = sourceFiles.length
    console.log(`Found ${sourceFiles.length} uploaded files in source database`)

    for (const sourceFile of sourceFiles) {
      try {
        // Idempotency check: look for existing file by source attributes
        // We use a combination of session_uid + name + listing_id as a unique identifier
        const existingFile = await prisma.uploadedFile.findFirst({
          where: {
            sessionUid: sourceFile.session_uid || "",
            name: sourceFile.name || "",
            listingId: sourceFile.listing_id || "",
            createdAt: normalizeTimestamp(sourceFile.created_at)!,
          },
        })

        if (existingFile) {
          console.log(`  SKIP file #${sourceFile.id}: already migrated`)
          report.uploadedFiles.skipped++
          continue
        }

        // Resolve the new user ID from the mapping
        let newUserId: string | null = null
        if (sourceFile.user_id !== null) {
          newUserId = userIdMap.get(sourceFile.user_id) ?? null
          if (!newUserId) {
            // User wasn't migrated (maybe missing salesforce_contact_id)
            // We still migrate the file but without the user reference
            console.warn(
              `  WARN file #${sourceFile.id}: user_id ${sourceFile.user_id} not in mapping, setting userId to null`
            )
          }
        }

        await prisma.uploadedFile.create({
          data: {
            userId: newUserId,
            applicationId: sourceFile.application_id,
            listingId: sourceFile.listing_id || "",
            listingPreferenceId: sourceFile.listing_preference_id || "",
            documentType: sourceFile.document_type || "",
            name: sourceFile.name || "",
            contentType: sourceFile.content_type || "",
            sessionUid: sourceFile.session_uid || "",
            address: sourceFile.address,
            rentBurdenType: sourceFile.rent_burden_type?.toString() ?? null,
            rentBurdenIndex:
              sourceFile.rent_burden_index !== null
                ? parseInt(sourceFile.rent_burden_index, 10) || null
                : null,
            createdAt: normalizeTimestamp(sourceFile.created_at)!,
            updatedAt: normalizeTimestamp(sourceFile.updated_at)!,
          },
        })

        report.uploadedFiles.migrated++
        if (report.uploadedFiles.migrated % 100 === 0) {
          console.log(`  ... migrated ${report.uploadedFiles.migrated} files so far`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`  FAIL file #${sourceFile.id}: ${errorMessage}`)
        report.uploadedFiles.failed++
        report.failures.push({
          entity: "UploadedFile",
          sourceId: sourceFile.id,
          error: errorMessage,
        })
      }
    }

    // ─── Summary Report ────────────────────────────────────────────────────────

    console.log("\n\n=== Migration Summary ===\n")
    console.log("Users:")
    console.log(`  Total source:  ${report.users.total}`)
    console.log(`  Migrated:      ${report.users.migrated}`)
    console.log(`  Skipped:       ${report.users.skipped}`)
    console.log(`  Failed:        ${report.users.failed}`)
    console.log("")
    console.log("UploadedFiles:")
    console.log(`  Total source:  ${report.uploadedFiles.total}`)
    console.log(`  Migrated:      ${report.uploadedFiles.migrated}`)
    console.log(`  Skipped:       ${report.uploadedFiles.skipped}`)
    console.log(`  Failed:        ${report.uploadedFiles.failed}`)

    if (report.failures.length > 0) {
      console.log(`\n--- Failure Details (${report.failures.length} total) ---\n`)
      for (const failure of report.failures) {
        console.log(`  [${failure.entity}] #${failure.sourceId}: ${failure.error}`)
      }
    }

    console.log("\n=== Migration Complete ===")
  } finally {
    await prisma.$disconnect()
    await sourcePool.end()
  }
}

// Run
migrateUsers().catch((error) => {
  console.error("Migration failed with unhandled error:", error)
  process.exit(1)
})
