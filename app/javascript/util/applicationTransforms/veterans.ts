/**
 * Veterans preference (DAH-3678).
 *
 * Veterans is not shaped like the other preferences. Rather than producing a
 * `shortFormPreferences` entry, the answer is stamped onto the *members*:
 * Salesforce needs to know which person is the veteran, so `isVeteran` is
 * written onto `primaryApplicant` and each `householdMembers[]` entry.
 *
 * Angular: the two `veteranMemberId` blocks in `formatApplication`
 * (L119-149) plus `_formatHouseholdMembers`.
 *
 * Only applied when the form actually asked the question — the step is gated on
 * the listing having the veteran preference, so an absent `_isAnyoneAVeteran`
 * means "not asked" and no `isVeteran` is written at all. This mirrors Angular's
 * `showVeteransApplicationQuestion()` guard.
 */

/** The id `allHouseholdMembers` uses for the applicant in the member dropdown. */
export const PRIMARY_APPLICANT_MEMBER_ID = "primaryApplicant"

type Data = Record<string, unknown>

/** Radio values on the veterans step -> the value Salesforce stores. */
const VETERAN_ANSWER_TO_SF: Record<string, string> = {
  yes: "Yes",
  no: "No",
  preferNotToAnswer: "Decline to state",
}

const SF_TO_VETERAN_ANSWER: Record<string, string> = {
  Yes: "yes",
  No: "no",
  "Decline to state": "preferNotToAnswer",
}

/**
 * The member dropdown's option values come from `allHouseholdMembers`, which
 * uses each member's `id`. Fall back to the array index for members created
 * before an id was assigned.
 */
const memberId = (member: Data, index: number): string =>
  (member.id as string) ?? (member.appMemberId as string) ?? String(index)

/**
 * Writes `isVeteran` onto the applicant and each member, and returns the
 * top-level `isNonPrimaryMemberVeteran` answer.
 *
 * Mutation-free: returns new member objects.
 */
export const applyVeteranStatus = (
  formData: Data,
  primaryApplicant: Data,
  householdMembers: Data[]
): { primaryApplicant: Data; householdMembers: Data[]; isNonPrimaryMemberVeteran?: string } => {
  const answer = formData._isAnyoneAVeteran as string | undefined

  // question not asked for this listing — leave the members untouched
  if (!answer) return { primaryApplicant, householdMembers }

  const sfAnswer = VETERAN_ANSWER_TO_SF[answer]

  // "No" / "Decline to state" is stamped on every member, since it is an answer
  // about the household as a whole rather than about one person.
  if (answer !== "yes") {
    return {
      primaryApplicant: { ...primaryApplicant, isVeteran: sfAnswer ?? null },
      householdMembers: householdMembers.map((member) => ({
        ...member,
        isVeteran: sfAnswer ?? null,
      })),
      isNonPrimaryMemberVeteran: sfAnswer,
    }
  }

  // "Yes" identifies exactly one member; everyone else is explicitly null so a
  // previously-saved answer is cleared.
  const veteranId = formData._veteranMemberId as string | undefined
  const isApplicant = veteranId === PRIMARY_APPLICANT_MEMBER_ID

  return {
    primaryApplicant: { ...primaryApplicant, isVeteran: isApplicant ? "Yes" : null },
    householdMembers: householdMembers.map((member, index) => ({
      ...member,
      isVeteran: memberId(member, index) === veteranId ? "Yes" : null,
    })),
    isNonPrimaryMemberVeteran: isApplicant ? undefined : "Yes",
  }
}

/**
 * The inverse: recover the veterans step's answers from the stamped members.
 * Used by DAH-3533 (draft resume).
 */
export const veteranStatusToFormData = (
  primaryApplicant: Data | undefined,
  householdMembers: Data[] | undefined
): Data => {
  const applicant = primaryApplicant ?? {}
  const members = householdMembers ?? []
  const all = [applicant, ...members]

  // nobody carries an isVeteran value -> the question was never asked
  if (all.every((member) => member.isVeteran === undefined)) return {}

  const veteran = all.find((member) => member.isVeteran === "Yes")
  if (veteran) {
    return {
      _isAnyoneAVeteran: "yes",
      _veteranMemberId:
        veteran === applicant ? PRIMARY_APPLICANT_MEMBER_ID : memberId(veteran, members.indexOf(veteran)),
    }
  }

  // otherwise every member carries the same household-wide answer
  const answer = all.map((member) => member.isVeteran).find(Boolean) as string | undefined
  if (!answer) return { _isAnyoneAVeteran: undefined, _veteranMemberId: "" }

  return { _isAnyoneAVeteran: SF_TO_VETERAN_ANSWER[answer], _veteranMemberId: "" }
}
