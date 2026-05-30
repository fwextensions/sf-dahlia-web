/**
 * EasyPost address validation integration.
 *
 * Validates mailing/home addresses via the EasyPost Address Verification API.
 * Returns the validated/standardized address or validation errors.
 */

import { env } from "../../config/env"

export interface AddressInput {
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country?: string
}

export interface ValidatedAddress {
  street1: string
  street2: string | null
  city: string
  state: string
  zip: string
  country: string
  verified: boolean
}

export interface AddressValidationResult {
  success: boolean
  address: ValidatedAddress | null
  errors: string[]
}

const EASYPOST_BASE_URL = "https://api.easypost.com/v2"

/**
 * Validates an address using the EasyPost API.
 * Returns the standardized address if valid, or errors if not.
 */
export async function validateAddress(
  input: AddressInput
): Promise<AddressValidationResult> {
  const apiKey = env.EASYPOST_API_KEY

  if (!apiKey) {
    // If no API key configured, skip validation and return unverified
    return {
      success: true,
      address: {
        street1: input.street1,
        street2: input.street2 ?? null,
        city: input.city,
        state: input.state,
        zip: input.zip,
        country: input.country ?? "US",
        verified: false,
      },
      errors: [],
    }
  }

  const response = await fetch(`${EASYPOST_BASE_URL}/addresses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    },
    body: JSON.stringify({
      address: {
        street1: input.street1,
        street2: input.street2 ?? "",
        city: input.city,
        state: input.state,
        zip: input.zip,
        country: input.country ?? "US",
      },
      verify: ["delivery"],
    }),
  })

  if (!response.ok) {
    return {
      success: false,
      address: null,
      errors: [`EasyPost API error: ${response.status} ${response.statusText}`],
    }
  }

  const data = await response.json()

  // Check for verification errors
  const verifications = data.verifications?.delivery
  if (verifications?.success === false) {
    const verifyErrors = (verifications.errors ?? []).map(
      (e: { message: string }) => e.message
    )
    return {
      success: false,
      address: null,
      errors: verifyErrors.length > 0 ? verifyErrors : ["Address could not be verified"],
    }
  }

  return {
    success: true,
    address: {
      street1: data.street1 ?? input.street1,
      street2: data.street2 || null,
      city: data.city ?? input.city,
      state: data.state ?? input.state,
      zip: data.zip ?? input.zip,
      country: data.country ?? "US",
      verified: verifications?.success === true,
    },
    errors: [],
  }
}
