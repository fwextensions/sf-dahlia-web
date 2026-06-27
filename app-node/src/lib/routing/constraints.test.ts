import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the listing fetch (Salesforce round-trip) and the flag store so we can
// assert exactly when dalpConstraint reaches for a listing.
vi.mock("../listings/server-fns", () => ({
  getListingDetail: vi.fn(),
}))
vi.mock("../flags/unleash", () => ({
  buildFlagsStore: vi.fn(),
}))

import { dalpConstraint } from "./constraints"
import { getListingDetail } from "../listings/server-fns"
import { buildFlagsStore } from "../flags/unleash"
import { FLAGS } from "../flags/store"

const mockedGetListingDetail = vi.mocked(getListingDetail)
const mockedBuildFlagsStore = vi.mocked(buildFlagsStore)

describe("dalpConstraint", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("skips the listing fetch and allows the route when the DALP flag is off", async () => {
    mockedBuildFlagsStore.mockResolvedValue({ enabled: [] })

    const passes = await dalpConstraint("abc123")

    expect(passes).toBe(true)
    expect(mockedGetListingDetail).not.toHaveBeenCalled()
  })

  it("fetches the listing when the DALP flag is on", async () => {
    mockedBuildFlagsStore.mockResolvedValue({
      enabled: [FLAGS.DIRECTORY_DALP],
    })
    mockedGetListingDetail.mockResolvedValue({
      Custom_Listing_Type: "Some Other Type",
    } as never)

    const passes = await dalpConstraint("abc123")

    expect(passes).toBe(true)
    expect(mockedGetListingDetail).toHaveBeenCalledWith({ data: { id: "abc123" } })
  })

  it("redirects (fails) a DALP listing when the flag is on", async () => {
    mockedBuildFlagsStore.mockResolvedValue({
      enabled: [FLAGS.DIRECTORY_DALP],
    })
    mockedGetListingDetail.mockResolvedValue({
      Custom_Listing_Type: "Downpayment Assistance Loan Program",
    } as never)

    const passes = await dalpConstraint("abc123")

    expect(passes).toBe(false)
  })

  it("falls through to the fetch when flag evaluation errored", async () => {
    // On an Unleash error we must not skip the check — fetch and evaluate so a
    // genuine DALP listing still redirects.
    mockedBuildFlagsStore.mockResolvedValue({ enabled: [], error: true })
    mockedGetListingDetail.mockResolvedValue({
      Custom_Listing_Type: "Downpayment Assistance Loan Program",
    } as never)

    const passes = await dalpConstraint("abc123")

    expect(passes).toBe(false)
    expect(mockedGetListingDetail).toHaveBeenCalled()
  })

  it("allows the route when the listing cannot be fetched", async () => {
    mockedBuildFlagsStore.mockResolvedValue({
      enabled: [FLAGS.DIRECTORY_DALP],
    })
    mockedGetListingDetail.mockRejectedValue(new Error("backend down"))

    const passes = await dalpConstraint("abc123")

    expect(passes).toBe(true)
  })
})
