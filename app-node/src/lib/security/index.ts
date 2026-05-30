/**
 * Security utilities for the Node/TS server.
 *
 * Includes:
 * - CSRF protection documentation and assertions
 *
 * Validates: Requirement 12.1
 */

export { assertServerFunctionContext, CSRF_PROTECTED_METHODS } from "./csrf"
