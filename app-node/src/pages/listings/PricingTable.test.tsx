/**
 * Verifies the native pricing/income table end-to-end without a backend:
 * the AMI-metadata derivation (loader input) and the full render path
 * (occupancy grouping → AMI-derived income → @uic CategoryTable/accordions),
 * using the same Rails fixtures the legacy ListingDetailsPricingTable test uses.
 */
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { units as fixtureUnits } from "../../../../app/javascript/__tests__/data/RailsListingUnits/listing-units"
import { amiCharts as fixtureAmiCharts } from "../../../../app/javascript/__tests__/data/RailsAmiCharts/ami-charts"
import { groupedUnitsByOccupancy as expectedGrouping } from "../../../../app/javascript/__tests__/data/RailsListingUnits/grouped-units-by-occupancy"
import { groupAndSortUnitsByOccupancy } from "../../../../app/javascript/util/listingUtil"
import { getAmiChartMetaDataFromUnits } from "../../lib/listings/ami"
import { PricingTable } from "./PricingTable"
import type {
  SerializableAmiChart,
  SerializableListing,
  SerializableUnit,
} from "../../lib/listings/server-fns"

const units = fixtureUnits as unknown as SerializableUnit[]
const amiCharts = fixtureAmiCharts as unknown as SerializableAmiChart[]

describe("getAmiChartMetaDataFromUnits", () => {
  it("collects unique (type, year, percent) charts tagged Max/MinAmi", () => {
    const meta = getAmiChartMetaDataFromUnits(units)

    // All charts in the fixture are MOHCD / 2021.
    expect(meta.every((c) => c.type === "MOHCD" && c.year === 2021)).toBe(true)
    // Both a max-derived and a min-derived chart are present.
    expect(meta.some((c) => c.derivedFrom === "MaxAmi")).toBe(true)
    expect(meta.some((c) => c.derivedFrom === "MinAmi")).toBe(true)
    // Dedupes: e.g. percent 82 appears as both a max and min across units but
    // is only collected once per derivation.
    const tuples = meta.map((c) => `${c.derivedFrom}:${c.percent}`)
    expect(new Set(tuples).size).toBe(tuples.length)
  })

  it("returns an empty list when no units reference charts", () => {
    expect(getAmiChartMetaDataFromUnits([])).toEqual([])
  })
})

describe("AMI-derived occupancy grouping", () => {
  // groupAndSortUnitsByOccupancy is the data engine behind the table: it derives
  // each unit's min/max monthly income from the AMI charts and groups by
  // household size. Asserting it against the Rails fixture confirms the whole
  // AMI integration works through the SSR-safe import path (no window crash).
  it("matches the Rails expected grouping for the rental fixture", () => {
    const grouped = groupAndSortUnitsByOccupancy(
      fixtureUnits,
      fixtureAmiCharts as never,
      false
    )
    expect(grouped).toEqual(expectedGrouping)
  })
})

describe("PricingTable", () => {
  it("server-renders one occupancy accordion per household size without crashing", () => {
    const html = renderToString(
      <PricingTable listing={{} as SerializableListing} units={units} amiCharts={amiCharts} />
    )

    expect(html).not.toBe("")
    // One accordion per distinct occupancy in the fixture (household sizes 1–6).
    // (Accordion bodies — the rent/income tables — render on expand client-side.)
    const accordions = html.match(/data-testid="content-accordion-button"/g) ?? []
    expect(accordions).toHaveLength(expectedGrouping.length)
  })

  it("renders nothing when there are no units", () => {
    const html = renderToString(
      <PricingTable listing={{} as SerializableListing} units={[]} amiCharts={[]} />
    )
    expect(html).toBe("")
  })
})
