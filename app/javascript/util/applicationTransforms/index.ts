/**
 * Application transforms: formData <-> Salesforce-shaped Application.
 *
 * `formDataToApplication` replaces the hand-built object in
 * `formApiService.submitForm`. `applicationToFormData` is its inverse and is
 * what DAH-3533 (draft resume) will call.
 *
 * The per-domain sections below are the DAH-3677..3683 tickets. Each is a
 * field table in `fieldMaps.ts` plus, where unavoidable, a cross-field
 * transform. To add a field: add a line to the relevant table.
 */

import { type Application } from "../../api/types/rails/application/RailsApplication"
import { type RailsListingPreference } from "../../api/types/rails/listings/RailsListingPreferences"
import { adaPriorities, formMetadata, income, totalMonthlyRent } from "./crossFieldTransforms"
import { applyFromSf, applyToSf, prefixForm } from "./fieldMap"
import {
  alternateContactFieldMap,
  appMemberFieldMap,
  applicationFieldMap,
  demographicsFieldMap,
  householdMemberOnlyFieldMap,
  primaryApplicantOnlyFieldMap,
} from "./fieldMaps"
import { getShortFormPreferencesData, shortFormPreferencesToFormData } from "./preferences"
import {
  PRIMARY_APPLICANT_MEMBER_ID,
  applyVeteranStatus,
  veteranStatusToFormData,
} from "./veterans"

type Data = Record<string, unknown>

/**
 * Context the transforms need beyond formData itself. Preferences are keyed by
 * the listing's own preference records, so both directions need the listing.
 */
export interface TransformContext {
  listingPreferences?: RailsListingPreference[]
}

const PRIMARY_APPLICANT_PREFIX = "primaryApplicant"

/** The applicant's own fields: the shared member fields, prefixed, plus their own. */
const primaryApplicantMap = [
  ...prefixForm(appMemberFieldMap, PRIMARY_APPLICANT_PREFIX),
  ...primaryApplicantOnlyFieldMap,
  ...demographicsFieldMap,
]

/** A household member's fields, read from an entry in formData.householdMembers. */
const householdMemberMap = [...appMemberFieldMap, ...householdMemberOnlyFieldMap]

/** Cross-field transforms applied at the top level of the application. */
const applicationCrossFieldTransforms = [income, adaPriorities, totalMonthlyRent, formMetadata]

// DAH-3682
export const getPrimaryApplicantData = (formData: Data): Data =>
  applyToSf(primaryApplicantMap, formData)

export const getPrimaryApplicantFormData = (sfApplicant: Data): Data =>
  applyFromSf(primaryApplicantMap, sfApplicant ?? {})

// DAH-3681
export const getHouseholdMembersData = (formData: Data): Data[] =>
  ((formData.householdMembers as Data[]) ?? []).map((member) =>
    applyToSf(householdMemberMap, member)
  )

export const getHouseholdMembersFormData = (sfMembers: Data[]): Data[] =>
  (sfMembers ?? []).map((member) => applyFromSf(householdMemberMap, member))

// DAH-3680
export const getAlternateContactData = (formData: Data): Data =>
  applyToSf(alternateContactFieldMap, formData)

export const getAlternateContactFormData = (sfContact: Data): Data =>
  applyFromSf(alternateContactFieldMap, sfContact ?? {})

/**
 * Every person on the application, in the shape the preference and veteran
 * transforms match against. `id` is what the member-select dropdowns store.
 */
const allFormMembers = (formData: Data): Data[] => [
  {
    id: PRIMARY_APPLICANT_MEMBER_ID,
    appMemberId: formData.primaryApplicantAppMemberId,
    firstName: formData.primaryApplicantFirstName,
    lastName: formData.primaryApplicantLastName,
    birthYear: formData.primaryApplicantBirthYear,
    birthMonth: formData.primaryApplicantBirthMonth,
    birthDate: formData.primaryApplicantBirthDate,
  },
  ...(((formData.householdMembers as Data[]) ?? []).map((member) => ({ ...member }))),
]

/**
 * formData -> the payload posted to /api/v1/short-form/application.
 *
 * Fields not yet mapped: uploaded proof files (DAH-3685). Only the applicant's
 * chosen proof *type* round-trips today.
 */
export const formDataToApplication = (
  formData: Data,
  context: TransformContext = {}
): Partial<Application> => {
  const veterans = applyVeteranStatus(
    formData,
    getPrimaryApplicantData(formData),
    getHouseholdMembersData(formData)
  )

  const application: Data = {
    ...applyToSf(applicationFieldMap, formData),
    primaryApplicant: veterans.primaryApplicant,
    householdMembers: veterans.householdMembers,
    shortFormPreferences: getShortFormPreferencesData(
      formData,
      context.listingPreferences,
      allFormMembers(formData)
    ),
  }

  if (veterans.isNonPrimaryMemberVeteran) {
    application.isNonPrimaryMemberVeteran = veterans.isNonPrimaryMemberVeteran
  }

  const alternateContact = getAlternateContactData(formData)
  // Angular only sent the object when the applicant actually named someone
  if (
    formData.alternateContactType &&
    formData.alternateContactType !== "None" &&
    alternateContact.firstName &&
    alternateContact.lastName
  ) {
    application.alternateContact = alternateContact
  }

  for (const transform of applicationCrossFieldTransforms) {
    Object.assign(application, transform.toSf(formData))
  }

  return application as Partial<Application>
}

/** The inverse: a Salesforce application -> formData. Used by DAH-3533. */
export const applicationToFormData = (
  sfApplication: Partial<Application>,
  context: TransformContext = {}
): Data => {
  const sfData = (sfApplication ?? {}) as Data
  const formData: Data = {
    ...applyFromSf(applicationFieldMap, sfData),
    ...getPrimaryApplicantFormData(sfData.primaryApplicant as Data),
    householdMembers: getHouseholdMembersFormData(sfData.householdMembers as Data[]),
    ...veteranStatusToFormData(
      sfData.primaryApplicant as Data,
      sfData.householdMembers as Data[]
    ),
  }

  Object.assign(
    formData,
    shortFormPreferencesToFormData(
      sfData.shortFormPreferences as Data[],
      context.listingPreferences,
      allFormMembers(formData)
    )
  )

  const sfAlternateContact = sfData.alternateContact as Data
  if (sfAlternateContact && sfAlternateContact.alternateContactType) {
    Object.assign(formData, getAlternateContactFormData(sfAlternateContact))
  } else {
    formData.alternateContactType = "None"
  }

  for (const transform of applicationCrossFieldTransforms) {
    Object.assign(formData, transform.fromSf(sfData))
  }

  return formData
}
