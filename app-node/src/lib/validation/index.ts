/**
 * Validation utilities for server function input validation.
 *
 * Provides:
 * - formatValidationErrors: Converts Zod errors into client-safe field error messages
 * - createValidatedInput: Higher-order wrapper that validates input and throws 4xx on failure
 *
 * Validates: Requirements 12.2, 12.7
 */

export { formatValidationErrors } from "./formatValidationErrors"
export type { ValidationErrorResponse } from "./formatValidationErrors"
export { createValidatedInput } from "./createValidatedInput"
