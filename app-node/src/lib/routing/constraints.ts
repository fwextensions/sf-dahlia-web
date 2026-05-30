/**
 * Route constraints replicating Rails DalpConstraint, HowToApplyConstraint,
 * and AccountLayoutConstraint.
 *
 * These run server-side and control conditional routing behavior
 * (e.g., showing a page vs redirecting to an alternate URL).
 */

import { env } from "../../config/env"

interface Listing {
  Custom_Listing_Type?: string
  RecordType?: { Name: string }
  Listing_Type?: string
  Status?: string
  Accepting_Online_Applications?: boolean
}

/**
 * Fetches a listing from the Salesforce proxy for constraint evaluation.
 * Returns null if the listing cannot be fetched.
 */
async function fetchListing(listingId: string): Promise<Listing | null> {
  try {
    const response = await fetch(
      `${env.RAILS_API_BASE_URL}/api/v1/listings/${listingId}`,
      {
        headers: {
          Accept: "application/json",
          ...(env.INTERNAL_API_KEY
            ? { "X-Internal-Api-Key": env.INTERNAL_API_KEY }
            : {}),
        },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!response.ok) return null
    const data = await response.json()
    // The Rails API returns { listing: {...} } envelope
    return data.listing ?? data
  } catch {
    return null
  }
}

/**
 * DalpConstraint: Returns true if the listing is NOT a DALP listing.
 * If the listing IS a DALP listing (Custom_Listing_Type === "Downpayment Assistance Loan Program"),
 * returns false, which means the route should fall through to a redirect.
 */
export async function dalpConstraint(listingId: string): Promise<boolean> {
  const listing = await fetchListing(listingId)
  if (!listing) return true // If we can't fetch, allow the route
  if (listing.Custom_Listing_Type === "Downpayment Assistance Loan Program") {
    return false
  }
  return true
}

/**
 * HowToApplyConstraint: Returns true if the listing is an active FCFS ownership (BMR) listing.
 * The "how to apply" page is only available when:
 * - RecordType.Name === "Ownership"
 * - Listing_Type === "First Come, First Served"
 * - Status === "Active"
 * - Accepting_Online_Applications === true
 */
export async function howToApplyConstraint(listingId: string): Promise<boolean> {
  const listing = await fetchListing(listingId)
  if (!listing) return false
  const isFcfsSalesBmr =
    listing.RecordType?.Name === "Ownership" &&
    listing.Listing_Type === "First Come, First Served"
  const isActive =
    listing.Status === "Active" &&
    listing.Accepting_Online_Applications === true
  return isFcfsSalesBmr && isActive
}

/**
 * AccountLayoutConstraint: Returns true if the new account layout feature flag is enabled.
 * This checks an Unleash feature flag. For the Node implementation, we use an
 * environment variable or a feature flag service call.
 */
export async function accountLayoutConstraint(): Promise<boolean> {
  // In the Node app, feature flag checking will use Unleash SDK.
  // For now, we check an environment variable that can be set by the Unleash integration.
  const flagValue = process.env.FEATURE_NEW_ACCOUNT_LAYOUT
  return flagValue === "true" || flagValue === "1"
}
