/**
 * Tests for formatValidationErrors utility.
 *
 * Validates: Requirements 12.2, 12.7
 */

import { describe, it, expect } from "vitest"
import { z } from "zod"
import { formatValidationErrors } from "./formatValidationErrors"
import { createValidatedInput, ValidationError } from "./createValidatedInput"

describe("formatValidationErrors", () => {
  it("formats required field errors", () => {
    const schema = z.object({
      firstName: z.string().min(1),
      email: z.string().email(),
    })

    const result = schema.safeParse({})
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields).toHaveProperty("firstName")
    expect(formatted.fields).toHaveProperty("email")
    expect(formatted.fields.firstName).toBe("This field is required")
    expect(formatted.fields.email).toBe("This field is required")
  })

  it("formats min-length string errors", () => {
    const schema = z.object({
      name: z.string().min(3),
    })

    const result = schema.safeParse({ name: "ab" })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields.name).toBe("Must be at least 3 characters")
  })

  it("formats empty string errors (min 1)", () => {
    const schema = z.object({
      name: z.string().min(1),
    })

    const result = schema.safeParse({ name: "" })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields.name).toBe("This field must not be empty")
  })

  it("formats email validation errors", () => {
    const schema = z.object({
      email: z.string().email(),
    })

    const result = schema.safeParse({ email: "not-an-email" })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields.email).toBe("Must be a valid email address")
  })

  it("formats nested field paths with dot notation", () => {
    const schema = z.object({
      primaryApplicant: z.object({
        firstName: z.string().min(1),
        email: z.string().email(),
      }),
    })

    const result = schema.safeParse({
      primaryApplicant: { firstName: "", email: "bad" },
    })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields["primaryApplicant.firstName"]).toBe(
      "This field must not be empty"
    )
    expect(formatted.fields["primaryApplicant.email"]).toBe(
      "Must be a valid email address"
    )
  })

  it("formats array index paths", () => {
    const schema = z.object({
      householdMembers: z.array(
        z.object({
          firstName: z.string().min(1),
        })
      ),
    })

    const result = schema.safeParse({
      householdMembers: [{ firstName: "" }],
    })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields["householdMembers.0.firstName"]).toBe(
      "This field must not be empty"
    )
  })

  it("keeps only first error per field", () => {
    // A string that's both too short AND invalid format
    const schema = z.object({
      code: z.string().min(5).email(),
    })

    const result = schema.safeParse({ code: "x" })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    // Should only have one entry for "code"
    const codeErrors = Object.keys(formatted.fields).filter((k) => k === "code")
    expect(codeErrors).toHaveLength(1)
  })

  it("formats number type errors", () => {
    const schema = z.object({
      age: z.number(),
    })

    const result = schema.safeParse({ age: "not a number" })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields.age).toBe("Expected number, received string")
  })

  it("formats max-length errors", () => {
    const schema = z.object({
      bio: z.string().max(10),
    })

    const result = schema.safeParse({ bio: "a very long string here" })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields.bio).toBe("Must be at most 10 characters")
  })

  it("formats enum errors", () => {
    const schema = z.object({
      status: z.enum(["draft", "submitted", "removed"]),
    })

    const result = schema.safeParse({ status: "invalid" })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields.status).toBe(
      "Must be one of: draft, submitted, removed"
    )
  })

  it("uses _root for top-level errors with no path", () => {
    // A union type produces errors with empty path
    const schema = z.string().min(1)

    const result = schema.safeParse("")
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    expect(formatted.fields._root).toBeDefined()
  })

  it("does not expose internal regex patterns", () => {
    const schema = z.object({
      phone: z.string().regex(/^\+1\d{10}$/),
    })

    const result = schema.safeParse({ phone: "bad" })
    expect(result.success).toBe(false)
    if (result.success) return

    const formatted = formatValidationErrors(result.error)
    // Should NOT contain the regex pattern
    expect(formatted.fields.phone).toBe("Invalid format")
    expect(formatted.fields.phone).not.toContain("\\+1")
    expect(formatted.fields.phone).not.toContain("regex")
  })
})

describe("createValidatedInput", () => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
  })

  it("returns parsed data on valid input", () => {
    const validate = createValidatedInput(schema)
    const result = validate({ name: "Alice", email: "alice@test.com" })
    expect(result).toEqual({ name: "Alice", email: "alice@test.com" })
  })

  it("throws ValidationError on invalid input", () => {
    const validate = createValidatedInput(schema)

    expect(() => validate({ name: "", email: "bad" })).toThrow(ValidationError)
  })

  it("ValidationError contains structured field errors", () => {
    const validate = createValidatedInput(schema)

    try {
      validate({ name: "", email: "bad" })
      expect.fail("Should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      const validationErr = err as ValidationError
      expect(validationErr.statusCode).toBe(422)
      expect(validationErr.fields.name).toBe("This field must not be empty")
      expect(validationErr.fields.email).toBe("Must be a valid email address")
    }
  })

  it("ValidationError.toJSON() returns safe response body", () => {
    const validate = createValidatedInput(schema)

    try {
      validate({})
      expect.fail("Should have thrown")
    } catch (err) {
      const validationErr = err as ValidationError
      const json = validationErr.toJSON()
      expect(json).toEqual({
        error: "Validation failed",
        fields: {
          name: "This field is required",
          email: "This field is required",
        },
      })
    }
  })

  it("does not expose stack traces or internal details in toJSON()", () => {
    const validate = createValidatedInput(schema)

    try {
      validate({})
      expect.fail("Should have thrown")
    } catch (err) {
      const validationErr = err as ValidationError
      const json = JSON.stringify(validationErr.toJSON())
      expect(json).not.toContain("stack")
      expect(json).not.toContain("node_modules")
      expect(json).not.toContain("ZodError")
    }
  })
})
