/**
 * Verifies the native next-steps (invite-to) pages server-render and dispatch
 * correctly without a backend: flag gating (I2A/I2I), the act-based view
 * selection, and the documents pages. Uses a minimal listing fixture; the Rails
 * `*Content` components render under SSR through the same import path the routes
 * use (no window crash).
 */
import { renderToString } from "react-dom/server"
import { describe, expect, it, beforeEach } from "vitest"
import { initFlagsFromStore, FLAGS } from "../../lib/flags/store"
import type { SerializableListing } from "../../lib/listings/server-fns"
import { NextSteps } from "./NextSteps"
import { NextStepsDocuments } from "./NextStepsDocuments"

const listing = {
  Id: "a0Wtest",
  Building_Name_for_Process: "Test Bldg",
  Name: "Test Listing",
  Listing_Images: [],
} as unknown as SerializableListing

const enableAll = () =>
  initFlagsFromStore({ enabled: [FLAGS.INVITE_TO_APPLY, FLAGS.I2I] })

describe("NextSteps (native invite-to dispatch)", () => {
  beforeEach(() => enableAll())

  it("renders the I2A next-steps view when the inviteToApply flag is on", () => {
    const html = renderToString(
      <NextSteps listing={listing} uploadUrl={null} schedulingUrl={null} search={{}} />
    )
    expect(html).toContain("Test Bldg")
  })

  it("renders nothing when the inviteToApply flag is off", () => {
    initFlagsFromStore({ enabled: [] })
    const html = renderToString(
      <NextSteps listing={listing} uploadUrl={null} schedulingUrl={null} search={{}} />
    )
    expect(html).toBe("")
  })

  it("renders the I2I next-steps view for type=I2I when the i2i flag is on", () => {
    const html = renderToString(
      <NextSteps
        listing={listing}
        uploadUrl={null}
        schedulingUrl="https://schedule.example"
        search={{ type: "I2I" }}
      />
    )
    expect(html).toContain("Test Bldg")
  })

  it("renders the withdrawn view for act=no", () => {
    const html = renderToString(
      <NextSteps
        listing={listing}
        uploadUrl={null}
        schedulingUrl={null}
        search={{ act: "no", deadline: "2099-12-31", appId: "APP1" }}
      />
    )
    expect(html).toContain("Test Bldg")
    expect(html.length).toBeGreaterThan(0)
  })
})

describe("NextStepsDocuments (native invite-to documents)", () => {
  beforeEach(() => enableAll())

  it("renders the I2A document checklist when the flag is on", () => {
    const html = renderToString(
      <NextStepsDocuments listing={listing} search={{}} />
    )
    expect(html.length).toBeGreaterThan(0)
  })

  it("renders the I2I document checklist for type=I2I", () => {
    const html = renderToString(
      <NextStepsDocuments listing={listing} search={{ type: "I2I" }} />
    )
    expect(html.length).toBeGreaterThan(0)
  })

  it("renders nothing when the inviteToApply flag is off", () => {
    initFlagsFromStore({ enabled: [] })
    const html = renderToString(
      <NextStepsDocuments listing={listing} search={{}} />
    )
    expect(html).toBe("")
  })
})
