import { type RailsListingPreference } from "../../../api/types/rails/listings/RailsListingPreferences"
import { PREFERENCES } from "../../../modules/constants"
import {
  getPreferenceRecordType,
  getShortFormPreferencesData,
  shortFormPreferencesToFormData,
} from "../../../util/applicationTransforms/preferences"

const listingPreference = (
  preferenceName: string,
  listingPreferenceID: string
): RailsListingPreference =>
  ({ preferenceName, listingPreferenceID }) as RailsListingPreference

const liveWork = listingPreference(PREFERENCES.liveWorkInSf, "lp-live-work")
const cop = listingPreference(PREFERENCES.certificateOfPreference, "lp-cop")
const rentBurden = listingPreference(PREFERENCES.assistedHousing, "lp-rent-burden")

const members = [
  {
    id: "primaryApplicant",
    appMemberId: "am-1",
    firstName: "Alice",
    lastName: "Cooper",
    birthYear: "1985",
    birthMonth: "6",
    birthDate: "5",
  },
  { id: "member-1", appMemberId: "am-2", firstName: "Carol", lastName: "Cooper" },
]

describe("preferences transform (DAH-3677)", () => {
  describe("getPreferenceRecordType", () => {
    it("maps known preferences to their Salesforce record type", () => {
      expect(getPreferenceRecordType(liveWork)).toBe("L_W")
      expect(getPreferenceRecordType(cop)).toBe("COP")
      expect(getPreferenceRecordType(rentBurden)).toBe("RB_AHP")
      expect(getPreferenceRecordType(listingPreference(PREFERENCES.antiDisplacement, "x"))).toBe(
        "ADHP"
      )
    })

    it("falls back to Custom for a listing-specific preference", () => {
      expect(getPreferenceRecordType(listingPreference("588 Mission", "x"))).toBe("Custom")
    })
  })

  describe("getShortFormPreferencesData", () => {
    it("omits preferences the applicant neither claimed nor declined", () => {
      expect(getShortFormPreferencesData({}, [liveWork, cop], members)).toEqual([])
    })

    it("omits preferences the listing does not offer", () => {
      const formData = {
        claimedPreferences: { certificateOfPreference: { preferenceClaimed: true } },
      }
      // the listing only offers live/work, so the COP claim has nowhere to go
      expect(getShortFormPreferencesData(formData, [liveWork], members)).toEqual([])
    })

    it("maps a simple claimed preference with its member and proof", () => {
      const formData = {
        claimedPreferences: {
          certificateOfPreference: {
            preferenceClaimed: true,
            householdMemberId: "member-1",
            certificateNumber: "12345",
          },
        },
      }
      expect(getShortFormPreferencesData(formData, [cop], members)).toEqual([
        {
          listingPreferenceID: "lp-cop",
          recordTypeDevName: "COP",
          optOut: false,
          appMemberID: "am-2",
          certificateNumber: "12345",
        },
      ])
    })

    it("records the individual preference for a combo preference", () => {
      const formData = {
        claimedPreferences: {
          liveInSf: {
            preferenceClaimed: true,
            householdMemberId: "primaryApplicant",
            proofType: "Gas bill",
          },
        },
      }
      const [entry] = getShortFormPreferencesData(formData, [liveWork], members)
      expect(entry).toMatchObject({
        listingPreferenceID: "lp-live-work",
        recordTypeDevName: "L_W",
        individualPreference: "Live in SF",
        preferenceProof: "Gas bill",
        appMemberID: "am-1",
      })
    })

    it("builds the naturalKey from the claiming member's name and padded dob", () => {
      const formData = {
        claimedPreferences: {
          liveInSf: { preferenceClaimed: true, householdMemberId: "primaryApplicant" },
        },
      }
      const [entry] = getShortFormPreferencesData(formData, [liveWork], members)
      expect(entry.naturalKey).toBe("Alice,Cooper,1985-06-05")
    })

    it("omits the naturalKey when the member has no complete dob", () => {
      const formData = {
        claimedPreferences: {
          liveInSf: { preferenceClaimed: true, householdMemberId: "member-1" },
        },
      }
      const [entry] = getShortFormPreferencesData(formData, [liveWork], members)
      expect(entry).not.toHaveProperty("naturalKey")
    })

    it("sends an opt-out with no member or proof", () => {
      const formData = { _liveOrWorkInSfOptOut: true }
      expect(getShortFormPreferencesData(formData, [liveWork], members)).toEqual([
        { listingPreferenceID: "lp-live-work", recordTypeDevName: "L_W", optOut: true },
      ])
    })

    it("drops the member and proof when a claimed preference is also opted out of", () => {
      const formData = {
        _liveOrWorkInSfOptOut: true,
        claimedPreferences: {
          liveInSf: {
            preferenceClaimed: true,
            householdMemberId: "primaryApplicant",
            proofType: "Gas bill",
          },
        },
      }
      const [entry] = getShortFormPreferencesData(formData, [liveWork], members)
      expect(entry.optOut).toBe(true)
      expect(entry).not.toHaveProperty("appMemberID")
      expect(entry).not.toHaveProperty("preferenceProof")
    })

    it("maps the rent burden side of the assisted housing combo", () => {
      const formData = {
        claimedPreferences: {
          rentBurden: { preferenceClaimed: true, householdMemberId: "primaryApplicant" },
        },
      }
      const [entry] = getShortFormPreferencesData(formData, [rentBurden], members)
      expect(entry.individualPreference).toBe("Rent Burdened")
    })
  })

  describe("shortFormPreferencesToFormData", () => {
    it("round-trips a simple claimed preference", () => {
      const formData = {
        claimedPreferences: {
          certificateOfPreference: {
            preferenceClaimed: true,
            householdMemberId: "member-1",
            certificateNumber: "12345",
          },
        },
      }
      const sf = getShortFormPreferencesData(formData, [cop], members)
      expect(shortFormPreferencesToFormData(sf, [cop], members).claimedPreferences).toEqual(
        formData.claimedPreferences
      )
    })

    it("round-trips a combo preference back to the right side", () => {
      const formData = {
        claimedPreferences: {
          liveInSf: {
            preferenceClaimed: true,
            householdMemberId: "primaryApplicant",
            proofType: "Gas bill",
          },
        },
      }
      const sf = getShortFormPreferencesData(formData, [liveWork], members)
      const restored = shortFormPreferencesToFormData(sf, [liveWork], members)
      expect(restored.claimedPreferences).toEqual(formData.claimedPreferences)
      // and remembers which side of the combo was picked
      expect(restored._liveOrWorkInSfClaimedPreference).toBe("liveInSf")
    })

    it("round-trips an opt-out", () => {
      const sf = getShortFormPreferencesData({ _liveOrWorkInSfOptOut: true }, [liveWork], members)
      const restored = shortFormPreferencesToFormData(sf, [liveWork], members)
      expect(restored._liveOrWorkInSfOptOut).toBe(true)
      expect(restored.claimedPreferences).toEqual({ liveWorkInSf: { preferenceClaimed: false } })
    })

    it("ignores an entry whose listing preference no longer exists", () => {
      const orphan = [{ listingPreferenceID: "gone", optOut: false }]
      expect(shortFormPreferencesToFormData(orphan, [liveWork], members)).toEqual({
        claimedPreferences: {},
      })
    })

    it("survives an application with no preferences", () => {
      expect(shortFormPreferencesToFormData(undefined, [liveWork], members)).toEqual({
        claimedPreferences: {},
      })
    })
  })
})
