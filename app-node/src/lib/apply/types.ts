/**
 * Types for the multi-step application form.
 */

export const APPLICATION_STEPS = [
  "intro",
  "you",
  "household",
  "preferences",
  "income",
  "review",
  "submit",
] as const

export type ApplicationStep = (typeof APPLICATION_STEPS)[number]

export interface ApplicantFormData {
  firstName: string
  lastName: string
  email: string
  DOB: string
  phone: string
  address: AddressFormData
  mailingAddress: AddressFormData | null
  alternatePhone: string
  alternatePhoneType: string
}

export interface AddressFormData {
  street1: string
  street2: string
  city: string
  state: string
  zip: string
}

export interface HouseholdMemberFormData {
  firstName: string
  lastName: string
  DOB: string
  relationship: string
}

export interface AlternateContactFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  alternateContactType: string
  agency: string
}

export interface PreferenceFormData {
  preferenceId: string
  preferenceName: string
  optedIn: boolean
  proofDocument: UploadedFileRef | null
}

export interface UploadedFileRef {
  url: string
  key: string
  fileName: string
  contentType: string
  documentType: string
  listingPreferenceId?: string
}

export interface IncomeFormData {
  incomeTimeframe: "per_year" | "per_month"
  incomeTotal: number
}

export interface ApplicationFormState {
  /** The current step in the form */
  currentStep: ApplicationStep
  /** Salesforce application ID (set after first save) */
  applicationId: string | null
  /** Listing this application is for */
  listingId: string
  /** Whether this is a resumed draft */
  isDraft: boolean
  /** Primary applicant info */
  applicant: ApplicantFormData
  /** Alternate contact */
  alternateContact: AlternateContactFormData
  /** Household members (not including primary applicant) */
  householdMembers: HouseholdMemberFormData[]
  /** Listing preferences opted in/out */
  preferences: PreferenceFormData[]
  /** Income info */
  income: IncomeFormData
  /** Uploaded file references */
  uploadedFiles: UploadedFileRef[]
}

/**
 * Creates an empty initial form state for a given listing.
 */
export function createInitialFormState(listingId: string): ApplicationFormState {
  return {
    currentStep: "intro",
    applicationId: null,
    listingId,
    isDraft: false,
    applicant: {
      firstName: "",
      lastName: "",
      email: "",
      DOB: "",
      phone: "",
      address: { street1: "", street2: "", city: "", state: "", zip: "" },
      mailingAddress: null,
      alternatePhone: "",
      alternatePhoneType: "",
    },
    alternateContact: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      alternateContactType: "",
      agency: "",
    },
    householdMembers: [],
    preferences: [],
    income: {
      incomeTimeframe: "per_year",
      incomeTotal: 0,
    },
    uploadedFiles: [],
  }
}
