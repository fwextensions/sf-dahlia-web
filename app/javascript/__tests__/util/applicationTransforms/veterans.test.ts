import {
  PRIMARY_APPLICANT_MEMBER_ID,
  applyVeteranStatus,
  veteranStatusToFormData,
} from "../../../util/applicationTransforms/veterans"

const applicant = { firstName: "Alice" }
const members = [
  { id: "member-1", firstName: "Carol" },
  { id: "member-2", firstName: "Dave" },
]

describe("veterans transform (DAH-3678)", () => {
  describe("applyVeteranStatus", () => {
    it("leaves the members alone when the listing never asked", () => {
      const result = applyVeteranStatus({}, applicant, members)
      expect(result.primaryApplicant).not.toHaveProperty("isVeteran")
      expect(result.householdMembers[0]).not.toHaveProperty("isVeteran")
      expect(result.isNonPrimaryMemberVeteran).toBeUndefined()
    })

    it("marks only the named household member as the veteran", () => {
      const result = applyVeteranStatus(
        { _isAnyoneAVeteran: "yes", _veteranMemberId: "member-2" },
        applicant,
        members
      )
      expect(result.primaryApplicant.isVeteran).toBeNull()
      expect(result.householdMembers[0].isVeteran).toBeNull()
      expect(result.householdMembers[1].isVeteran).toBe("Yes")
      expect(result.isNonPrimaryMemberVeteran).toBe("Yes")
    })

    it("marks the primary applicant when they are the veteran", () => {
      const result = applyVeteranStatus(
        { _isAnyoneAVeteran: "yes", _veteranMemberId: PRIMARY_APPLICANT_MEMBER_ID },
        applicant,
        members
      )
      expect(result.primaryApplicant.isVeteran).toBe("Yes")
      expect(result.householdMembers.every((member) => member.isVeteran === null)).toBe(true)
      // the applicant is not a "non primary" member
      expect(result.isNonPrimaryMemberVeteran).toBeUndefined()
    })

    it("stamps a No answer on every member", () => {
      const result = applyVeteranStatus({ _isAnyoneAVeteran: "no" }, applicant, members)
      expect(result.primaryApplicant.isVeteran).toBe("No")
      expect(result.householdMembers.map((member) => member.isVeteran)).toEqual(["No", "No"])
      expect(result.isNonPrimaryMemberVeteran).toBe("No")
    })

    it("stamps Decline to state on every member", () => {
      const result = applyVeteranStatus(
        { _isAnyoneAVeteran: "preferNotToAnswer" },
        applicant,
        members
      )
      expect(result.primaryApplicant.isVeteran).toBe("Decline to state")
      expect(result.householdMembers[0].isVeteran).toBe("Decline to state")
    })

    it("does not mutate its inputs", () => {
      applyVeteranStatus({ _isAnyoneAVeteran: "no" }, applicant, members)
      expect(applicant).not.toHaveProperty("isVeteran")
      expect(members[0]).not.toHaveProperty("isVeteran")
    })
  })

  describe("veteranStatusToFormData", () => {
    it("returns nothing when no one carries an answer", () => {
      expect(veteranStatusToFormData(applicant, members)).toEqual({})
    })

    it("round-trips a named household member", () => {
      const formData = { _isAnyoneAVeteran: "yes", _veteranMemberId: "member-2" }
      const sf = applyVeteranStatus(formData, applicant, members)
      expect(veteranStatusToFormData(sf.primaryApplicant, sf.householdMembers)).toEqual(formData)
    })

    it("round-trips the primary applicant", () => {
      const formData = {
        _isAnyoneAVeteran: "yes",
        _veteranMemberId: PRIMARY_APPLICANT_MEMBER_ID,
      }
      const sf = applyVeteranStatus(formData, applicant, members)
      expect(veteranStatusToFormData(sf.primaryApplicant, sf.householdMembers)).toEqual(formData)
    })

    it("round-trips the household-wide answers", () => {
      for (const answer of ["no", "preferNotToAnswer"]) {
        const sf = applyVeteranStatus({ _isAnyoneAVeteran: answer }, applicant, members)
        expect(veteranStatusToFormData(sf.primaryApplicant, sf.householdMembers)).toEqual({
          _isAnyoneAVeteran: answer,
          _veteranMemberId: "",
        })
      }
    })

    it("survives an application with no household members", () => {
      const sf = applyVeteranStatus({ _isAnyoneAVeteran: "no" }, applicant, [])
      expect(veteranStatusToFormData(sf.primaryApplicant, sf.householdMembers)).toEqual({
        _isAnyoneAVeteran: "no",
        _veteranMemberId: "",
      })
    })
  })
})
