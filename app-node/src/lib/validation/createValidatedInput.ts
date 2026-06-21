/**
 * Higher-order utility for creating TanStack Start inputValidator functions
 * that integrate Zod schema parsing with structured error responses.
 *
 * When validation fails, throws an error that TanStack Start surfaces
 * as a 4xx response (422 Unprocessable Entity) with a structured body
 * describing which fields failed and why.
 *
 * Validates: Requirements 12.2, 12.7
 */

import type { ZodSchema, ZodError } from "zod"
import { formatValidationErrors } from "./formatValidationErrors"

/**
 * Error class for validation failures.
 * Carries the structured field errors so the framework can serialize them.
 */
export class ValidationError extends Error {
  public readonly statusCode = 422
  public readonly fields: Record<string, string>

  constructor(zodError: ZodError) {
    const formatted = formatValidationErrors(zodError)
    super("Validation failed")
    this.name = "ValidationError"
    this.fields = formatted.fields
  }

  /** Returns the serializable error response body */
  toJSON() {
    return {
      error: "Validation failed",
      fields: this.fields,
    }
  }
}

/**
 * Creates an inputValidator function for use with TanStack Start's createServerFn.
 *
 * Usage:
 * ```ts
 * const myServerFn = createServerFn({ method: "POST" })
 *   .validator(createValidatedInput(myZodSchema))
 *   .handler(async ({ data }) => { ... })
 * ```
 *
 * If validation passes, returns the parsed (typed) data.
 * If validation fails, throws a ValidationError with structured field messages.
 */
export function createValidatedInput<T>(schema: ZodSchema<T>) {
  return (data: unknown): T => {
    const result = schema.safeParse(data)
    if (!result.success) {
      throw new ValidationError(result.error)
    }
    return result.data
  }
}
