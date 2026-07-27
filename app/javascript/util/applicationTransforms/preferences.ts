/**
 * Preferences (DAH-3677).
 *
 * Salesforce stores preferences as a flat `shortFormPreferences[]`, one entry
 * per *listing* preference, each pointing at the listing preference it answers
 * and at the household member claiming it. The form stores them as a map keyed
 * by the short preference name:
 *
 *   claimedPreferences: {
 *     liveWorkInSf: { preferenceClaimed: true, householdMemberId: "...", proofType: "Gas bill" },
 *     assistedHousing: { preferenceClaimed: false },
 *   }
 *
 * Two preferences are "combo" preferences: one Salesforce preference backs two
 * checkboxes in the UI, distinguished by `individualPreference`. The
 * `COMBO_PREFERENCES` table below is the whole of that special-casing — adding a
 * new combo preference means adding one entry.
 *
 * Angular: `_formatPreferences` (L233) / `_reformatPreferences` (L526).
 * Deliberately NOT ported from Angular:
 *  - the DALP educator / first responder branches, which belong to the sales
 *    form the React engine does not implement yet
 *  - proof *file* handling (DAH-3685); only the chosen proof type round-trips
 */

import { type RailsListingPreference } from "../../api/types/rails/listings/RailsListingPreferences"
import { PREFERENCES } from "../../modules/constants"
import { type ClaimedPreference } from "../../pages/form/components/preferences/PreferenceUtils"

type Data = Record<string, unknown>

/**
 * The Salesforce record type for each preference, derived from its long name.
 * Angular: `_getPreferenceRecordType`. Only used when the listing preference
 * does not already carry a `recordTypeDevName`.
 */
const RECORD_TYPE_BY_PREFERENCE: Record<string, string> = {
  [PREFERENCES.certificateOfPreference]: "COP",
  [PREFERENCES.displacedTenant]: "DTHP",
  [PREFERENCES.liveWorkInSf]: "L_W",
  [PREFERENCES.neighborhoodResidence]: "NRHP",
  [PREFERENCES.assistedHousing]: "RB_AHP",
  [PREFERENCES.antiDisplacement]: "ADHP",
  [PREFERENCES.rightToReturnSunnydale]: "AG",
  [PREFERENCES.rightToReturnHuntersView]: "AG",
  [PREFERENCES.rightToReturnPotrero]: "AG",
  [PREFERENCES.aliceGriffith]: "AG",
}

export const getPreferenceRecordType = (listingPreference: RailsListingPreference): string =>
  RECORD_TYPE_BY_PREFERENCE[listingPreference.preferenceName] ?? "Custom"

/**
 * Preferences where one Salesforce preference backs several UI checkboxes.
 *
 * `members` are the form-side preference names, in the order they should be
 * checked; `individualPreference` is the value Salesforce uses to tell them
 * apart. `comboName` is the form-side name of the umbrella checkbox, used when
 * the applicant opts out without picking a side.
 */
const COMBO_PREFERENCES: {
  preferenceName: string
  comboName?: string
  members: { formName: string; individualPreference: string }[]
}[] = [
  {
    preferenceName: PREFERENCES.liveWorkInSf,
    comboName: "liveWorkInSf",
    members: [
      { formName: "liveInSf", individualPreference: "Live in SF" },
      { formName: "workInSf", individualPreference: "Work in SF" },
    ],
  },
  {
    preferenceName: PREFERENCES.assistedHousing,
    members: [
      { formName: "rentBurden", individualPreference: "Rent Burdened" },
      { formName: "assistedHousing", individualPreference: "Assisted Housing" },
    ],
  },
]

/** The opt-out field name in formData for a given form-side preference name. */
const OPT_OUT_FIELDS: Record<string, string> = {
  liveWorkInSf: "_liveOrWorkInSfOptOut",
  liveInSf: "_liveOrWorkInSfOptOut",
  workInSf: "_liveOrWorkInSfOptOut",
  assistedHousing: "_assistedHousingOptOut",
  rentBurden: "_assistedHousingOptOut",
  neighborhoodResidence: "_neighborhoodResidenceOptOut",
  antiDisplacement: "_antiDisplacementOptOut",
}

const findCombo = (preferenceName: string) =>
  COMBO_PREFERENCES.find((combo) => combo.preferenceName === preferenceName)

/** All form-side names that could answer one listing preference. */
const formNamesFor = (preferenceName: string): string[] => {
  const combo = findCombo(preferenceName)
  if (combo) return combo.members.map((member) => member.formName)
  // otherwise the form uses the same short key the PREFERENCES map does
  const shortName = Object.keys(PREFERENCES).find((key) => PREFERENCES[key] === preferenceName)
  return shortName ? [shortName] : []
}

/**
 * `naturalKey` identifies the claiming member to Salesforce by name and date of
 * birth rather than by id. Angular built the same string in `_formatPreferences`.
 */
const naturalKeyFor = (member: Data | undefined): string | undefined => {
  if (!member) return undefined
  const dob = [member.birthYear, member.birthMonth, member.birthDate]
  if (dob.some((part) => !part)) return undefined
  const [year, month, day] = dob as string[]
  const padded = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  return `${member.firstName as string},${member.lastName as string},${padded}`
}

/**
 * formData -> shortFormPreferences[].
 *
 * Driven by the *listing's* preferences: Salesforce expects one entry per
 * preference the listing offers, including opt-outs, and ignores anything the
 * listing doesn't offer.
 */
export const getShortFormPreferencesData = (
  formData: Data,
  listingPreferences: RailsListingPreference[] | undefined,
  allMembers: Data[]
): Data[] => {
  const claimed = (formData.claimedPreferences as Record<string, ClaimedPreference>) ?? {}

  return (listingPreferences ?? []).flatMap((listingPreference) => {
    const combo = findCombo(listingPreference.preferenceName)
    const formNames = formNamesFor(listingPreference.preferenceName)

    // which of the candidate checkboxes did the applicant actually claim?
    const claimedName = formNames.find((name) => claimed[name]?.preferenceClaimed)
    // opting out is recorded against the umbrella checkbox, not the sub-choice
    const optOutName = combo?.comboName ?? formNames[0]
    const optOut = !!formData[OPT_OUT_FIELDS[optOutName ?? ""]]

    // the listing offers it but the applicant neither claimed nor declined it
    if (!claimedName && !optOut) return []

    const entry: Data = {
      listingPreferenceID: listingPreference.listingPreferenceID,
      recordTypeDevName: getPreferenceRecordType(listingPreference),
      optOut,
    }

    if (combo) {
      const member = combo.members.find((candidate) => candidate.formName === claimedName)
      if (member) entry.individualPreference = member.individualPreference
    }

    if (!optOut && claimedName) {
      const preference = claimed[claimedName]
      const claimingMember = allMembers.find(
        (candidate) => candidate.id === preference.householdMemberId
      )
      const appMemberID = claimingMember?.appMemberId ?? claimingMember?.id
      if (appMemberID) entry.appMemberID = appMemberID
      const naturalKey = naturalKeyFor(claimingMember)
      if (naturalKey) entry.naturalKey = naturalKey
      if (preference.proofType) entry.preferenceProof = preference.proofType
      if (preference.certificateNumber) entry.certificateNumber = preference.certificateNumber
    }

    return [entry]
  })
}

/**
 * The inverse: shortFormPreferences[] -> the form's claimedPreferences map plus
 * the opt-out flags. Used by DAH-3533.
 *
 * Needs the listing's preferences to map each entry's `listingPreferenceID`
 * back to a preference name, exactly as Angular's `_reformatPreferences` did.
 */
export const shortFormPreferencesToFormData = (
  shortFormPreferences: Data[] | undefined,
  listingPreferences: RailsListingPreference[] | undefined,
  allMembers: Data[]
): Data => {
  const claimedPreferences: Record<string, ClaimedPreference> = {}
  const formData: Data = {}

  for (const entry of shortFormPreferences ?? []) {
    const listingPreference = (listingPreferences ?? []).find(
      (candidate) => candidate.listingPreferenceID === entry.listingPreferenceID
    )
    // an entry we can't match to a listing preference can't be rendered
    if (!listingPreference) continue

    const combo = findCombo(listingPreference.preferenceName)
    const formNames = formNamesFor(listingPreference.preferenceName)
    let formName = formNames[0]

    if (combo) {
      const member = combo.members.find(
        (candidate) => candidate.individualPreference === entry.individualPreference
      )
      formName = member?.formName ?? combo.comboName ?? formNames[0]
    }
    if (!formName) continue

    const optOutField = OPT_OUT_FIELDS[combo?.comboName ?? formName]
    if (optOutField) formData[optOutField] = !!entry.optOut

    if (entry.optOut) {
      claimedPreferences[formName] = { preferenceClaimed: false }
      continue
    }

    const claimingMember = allMembers.find(
      (candidate) =>
        candidate.appMemberId === entry.appMemberID || candidate.id === entry.appMemberID
    )
    claimedPreferences[formName] = {
      preferenceClaimed: true,
      ...(claimingMember && { householdMemberId: claimingMember.id as string }),
      ...(entry.preferenceProof && { proofType: entry.preferenceProof as string }),
      ...(entry.certificateNumber && { certificateNumber: entry.certificateNumber as string }),
    }

    // the live/work step remembers which side of the combo was picked
    if (combo?.comboName === "liveWorkInSf" && formName !== "liveWorkInSf") {
      formData._liveOrWorkInSfClaimedPreference = formName
    }
  }

  formData.claimedPreferences = claimedPreferences
  return formData
}
