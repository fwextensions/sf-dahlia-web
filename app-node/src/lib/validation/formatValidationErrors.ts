/**
 * Validation error formatting utility.
 *
 * Transforms Zod validation errors into user-friendly error messages
 * without exposing internal system details (stack traces, schema structure, etc.).
 *
 * Validates: Requirements 12.2, 12.7
 */

import type { ZodError, ZodIssue } from "zod"

/**
 * Structured validation error response returned to clients.
 * Each field that failed validation gets a human-readable message.
 */
export interface ValidationErrorResponse {
  /** Map of field names to human-readable error messages */
  fields: Record<string, string>
}

/**
 * Formats a single Zod issue into a user-friendly error message.
 * Avoids exposing schema internals like exact regex patterns or internal type names.
 */
function formatIssueMessage(issue: ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      // Zod v4 no longer puts the received value on the issue object, so
      // fall back to the value Zod's own default message embeds.
      if (/received (undefined|null)$/.test(issue.message)) {
        return "This field is required"
      }
      return issue.message

    case "too_small":
      if (issue.origin === "string") {
        if (issue.minimum === 1) {
          return "This field must not be empty"
        }
        return `Must be at least ${issue.minimum} characters`
      }
      if (issue.origin === "number") {
        return `Must be at least ${issue.minimum}`
      }
      if (issue.origin === "array") {
        return `Must contain at least ${issue.minimum} item(s)`
      }
      return `Value is too small`

    case "too_big":
      if (issue.origin === "string") {
        return `Must be at most ${issue.maximum} characters`
      }
      if (issue.origin === "number") {
        return `Must be at most ${issue.maximum}`
      }
      if (issue.origin === "array") {
        return `Must contain at most ${issue.maximum} item(s)`
      }
      return `Value is too large`

    case "invalid_format":
      if (issue.format === "email") {
        return "Must be a valid email address"
      }
      if (issue.format === "url") {
        return "Must be a valid URL"
      }
      if (issue.format === "uuid") {
        return "Must be a valid identifier"
      }
      // Don't expose regex patterns
      return "Invalid format"

    case "invalid_value":
      return `Must be one of: ${issue.values.join(", ")}`

    case "unrecognized_keys":
      return `Unexpected field(s): ${issue.keys.join(", ")}`

    default:
      // Fallback: use Zod's message but strip anything after a newline
      // to avoid leaking multi-line internal details
      return issue.message.split("\n")[0]
  }
}

/**
 * Converts a Zod path array into a dot-notation field name.
 * Example: ["primaryApplicant", "email"] → "primaryApplicant.email"
 * Array indices are included: ["householdMembers", 0, "firstName"] → "householdMembers.0.firstName"
 */
function formatFieldPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return "_root"
  }
  return path.map(String).join(".")
}

/**
 * Formats a ZodError into a client-safe ValidationErrorResponse.
 *
 * - Groups errors by field path (dot notation)
 * - Returns only the first error per field to keep responses concise
 * - Does NOT expose internal schema structure, stack traces, or regex patterns
 *
 * @param error - A ZodError instance from a failed schema parse
 * @returns A structured error response safe to send to clients
 */
export function formatValidationErrors(error: ZodError): ValidationErrorResponse {
  const fields: Record<string, string> = {}

  for (const issue of error.issues) {
    const fieldPath = formatFieldPath(issue.path)

    // Only keep the first error per field
    if (!(fieldPath in fields)) {
      fields[fieldPath] = formatIssueMessage(issue)
    }
  }

  return { fields }
}
