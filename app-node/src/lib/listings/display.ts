/**
 * Display helpers for listing data, operating on the RAW Salesforce field keys
 * (see SerializableListing). Mirrors the Rails FE helpers so native pages format
 * listings identically:
 *  - getListingAddress ≈ app/javascript/components/ListingAddress.tsx
 *  - getListingImageUrl ≈ getImageCardProps in modules/listings/SharedHelpers.tsx
 */
import type { SerializableListing } from "./server-fns"

/**
 * The card/hero image: the first uploaded Listing_Image, else the `imageURL`
 * fallback the proxy provides. Returns undefined when neither is present.
 */
export function getListingImageUrl(listing: SerializableListing): string | undefined {
  // Listing_Images is a non-primitive raw field, reached via the index signature.
  const images = listing.Listing_Images as
    | Array<{ displayImageURL?: string }>
    | undefined
  const first = Array.isArray(images) ? images[0] : undefined
  if (first?.displayImageURL) return first.displayImageURL
  return typeof listing.imageURL === "string" ? listing.imageURL : undefined
}

/**
 * "Street, City, State Zip" — but only when all parts are present, matching
 * Rails ListingAddress (which renders nothing otherwise). Note the directory
 * payload omits street address/zip, so this is empty for directory cards, again
 * as in Rails.
 */
export function getListingAddress(listing: SerializableListing): string {
  const street = listing.Building_Street_Address
  const city = listing.Building_City
  const state = listing.Building_State
  const zip = listing.Building_Zip_Code
  if (street && city && state && zip) {
    return `${street}, ${city}, ${state} ${zip}`
  }
  return ""
}
