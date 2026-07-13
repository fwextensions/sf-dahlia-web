import { z } from "zod"

/**
 * Environment variable schema validated at startup.
 * RAILS_API_BASE_URL is exposed to the client for Phase 1 client-side API calls.
 */
const envSchema = z.object({
  RAILS_API_BASE_URL: z.string().url().default("http://localhost:3000"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  INTERNAL_API_KEY: z.string().default(""),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLERK_PUBLISHABLE_KEY: z.string().default(""),
  CLERK_SECRET_KEY: z.string().default(""),
  // S3 file upload
  AWS_S3_BUCKET: z.string().default(""),
  AWS_S3_REGION: z.string().default("us-west-1"),
  AWS_ACCESS_KEY_ID: z.string().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().default(""),
  // EasyPost address validation
  EASYPOST_API_KEY: z.string().default(""),
  // sf-dahlia-backend messaging service (application confirmation, i2a/i2i emails)
  DAHLIA_API_URL: z.string().default(""),
  DAHLIA_API_KEY: z.string().default(""),
  // Redis cache pre-warm job (runs on the worker dyno; see cache-prewarm-plan.md).
  // Disabled by default so it ships dark until observed.
  CACHE_WARM_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  // Repeat cadence in ms. Must stay comfortably below the listing TTLs (1 day)
  // so live keys never lapse between passes. Defaults to 6 hours.
  CACHE_WARM_INTERVAL_MS: z.coerce.number().int().positive().default(21_600_000),
  // Max listings warmed in parallel — the safety knob that keeps a warm pass
  // from starving live traffic on the Rails/Salesforce path.
  CACHE_WARM_CONCURRENCY: z.coerce.number().int().positive().default(4),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  return envSchema.parse(process.env)
}

export const env = loadEnv()

/**
 * Client-safe environment variables that can be exposed to the browser.
 * Only include values that are safe to be publicly visible.
 */
export const clientEnv = {
  RAILS_API_BASE_URL: env.RAILS_API_BASE_URL,
} as const
