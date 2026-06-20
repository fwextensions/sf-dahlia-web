/**
 * Type definitions for Salesforce proxy client requests and responses.
 * These types represent the normalized data returned by the Rails proxy
 * (with __c/__r suffixes stripped and single-level relationships flattened).
 */

// ============================================================
// Listings
// ============================================================

export interface ListingsParams {
  ids?: string
  type?: string
  subset?: string
}

export interface Listing {
  listingID: string
  name: string
  buildingAddress: string
  buildingCity: string
  buildingState: string
  buildingZip: string
  applicationDueDate: string | null
  lotteryDate: string | null
  lotteryStatus: string | null
  reservedDescriptor: string | null
  listingType: "rental" | "ownership"
  status: string
  [key: string]: unknown
}

export interface Unit {
  unitType: string
  bmrRentMonthly: number | null
  bmrRentTrimester: number | null
  bmrParkingMonthly: number | null
  numBedrooms: number | null
  numBathrooms: number | null
  sqFt: number | null
  floor: number | null
  maxOccupancy: number | null
  minOccupancy: number | null
  listingID: string
  [key: string]: unknown
}

export interface LotteryBucket {
  preferenceName: string
  preferenceOrder: number
  lotteryResults: LotteryResult[]
  [key: string]: unknown
}

export interface LotteryResult {
  lotteryNumber: string
  lotteryRank: number
  [key: string]: unknown
}

export interface LotteryRanking {
  lotteryNumber: string
  lotteryRank: number | null
  preferenceName: string | null
  [key: string]: unknown
}

export interface Preference {
  preferenceName: string
  preferenceOrder: number
  listingPreferenceID: string
  [key: string]: unknown
}

export interface AmiParams {
  chartType?: string
  chartYear?: string
  percent?: number
}

export interface AmiLevel {
  chartType: string
  year: number
  amount: number
  numOfHousehold: number
  percent: number
  [key: string]: unknown
}

/**
 * One AMI chart referenced by a unit, identified by (type, year, percent).
 * `derivedFrom` ("MaxAmi" | "MinAmi") records which unit field the chart was
 * pulled for — set client-side, since the Rails ami endpoint doesn't return it.
 */
export interface AmiChartMetaData {
  type: string
  year: number
  percent: number
  derivedFrom?: string
}

/**
 * A full AMI chart: the income amount per household size. Shape matches the
 * Rails `{ ami: [...] }` response (one entry per requested chart), with
 * `chartType`/`year`/`derivedFrom` enriched from the chart's values + the
 * request metadata to mirror the Rails listingDetailsReducer.
 */
export interface AmiChart {
  percent: string | number
  chartType?: string
  year?: number | string
  derivedFrom?: string
  values: AmiLevel[]
}

export interface EligibilityFilters {
  householdsize?: number
  incomelevel?: number
  childrenUnder6?: number
  [key: string]: unknown
}

// ============================================================
// Short Form Applications
// ============================================================

export interface EligibilityData {
  listingID: string
  [key: string]: unknown
}

export interface ValidationResult {
  valid: boolean
  errors?: string[]
  [key: string]: unknown
}

export interface Applicant {
  firstName: string
  lastName: string
  email: string | null
  DOB: string | null
  [key: string]: unknown
}

export interface AlternateContact {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  [key: string]: unknown
}

export interface HouseholdMember {
  firstName: string
  lastName: string
  DOB: string | null
  [key: string]: unknown
}

export interface ApplicationData {
  listingID: string
  primaryApplicant: Applicant
  alternateContact?: AlternateContact
  householdMembers?: HouseholdMember[]
  shortFormPreferences?: unknown[]
  annualIncome?: number
  monthlyIncome?: number
  [key: string]: unknown
}

export interface Application {
  id: string
  listingID: string
  status: "draft" | "submitted" | "removed"
  applicationLanguage: string
  lotteryNumber: string | null
  primaryApplicant: Applicant
  alternateContact: AlternateContact | null
  householdMembers: HouseholdMember[]
  shortFormPreferences: unknown[]
  annualIncome: number | null
  monthlyIncome: number | null
  [key: string]: unknown
}

export interface LendingInstitution {
  name: string
  [key: string]: unknown
}

// ============================================================
// Account
// ============================================================

export interface ContactUpdate {
  contactId: string
  [key: string]: unknown
}

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  [key: string]: unknown
}
