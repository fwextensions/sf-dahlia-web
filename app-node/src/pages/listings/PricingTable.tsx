/**
 * Native pricing / income table for the listing-detail route.
 *
 * Faithful port of app/javascript/modules/listingDetails/ListingDetailsPricingTable.tsx,
 * fed by loader data (props) instead of ListingDetailsContext. The heavy data
 * shaping (occupancy grouping, AMI-derived min/max income) reuses the pure
 * helpers in app/javascript/util/listingUtil — those are SSR-safe (no window at
 * module eval) and this component is code-split behind the detail route, so it
 * never reaches the eagerly-loaded root bundle.
 *
 * Units and AMI charts arrive as the serializable shapes from server-fns but
 * still carry the raw Salesforce fields the helpers read, so we cast to the
 * Rails types the helpers expect.
 */
import { CategoryTable, ContentAccordion, t } from "@uic"
import type { CategoryTableSection } from "@uic"
import type RailsUnit from "../../../../app/javascript/api/types/rails/listings/RailsUnit"
import type { RailsUnitWithOccupancyAndMinMaxIncome } from "../../../../app/javascript/api/types/rails/listings/RailsUnit"
import type { RailsAmiChart } from "../../../../app/javascript/api/types/rails/listings/RailsAmiChart"
import type { RailsListing } from "../../../../app/javascript/modules/listings/SharedHelpers"
import {
  groupAndSortUnitsByOccupancy,
  filterAvailableUnits,
  isSale,
  isHabitatListing,
} from "../../../../app/javascript/util/listingUtil"
import { getCurrencyString, getRangeString } from "../../lib/listings/currency"
import {
  defaultIfNotTranslated,
  renderInlineMarkup,
} from "../../../../app/javascript/util/languageUtil"
import type { SerializableAmiChart, SerializableUnit } from "../../lib/listings/server-fns"
import type { SerializableListing } from "../../lib/listings/server-fns"
import "../../../../app/javascript/modules/listingDetails/ListingDetailsPricingTable.css"

interface AmiRow {
  ami: { min: number | undefined; max: number }
  units: RailsUnitWithOccupancyAndMinMaxIncome[]
}

interface GroupedUnitsByOccupancy {
  occupancy: number
  absoluteMinIncome: number
  absoluteMaxIncome: number
  amiRows: AmiRow[]
}

const buildSalePriceCellRow = (unit: RailsUnitWithOccupancyAndMinMaxIncome) => {
  if (unit.Price_With_Parking && unit.Price_Without_Parking) {
    return [
      { cellText: String(unit.Price_With_Parking), cellSubText: t("listings.stats.withParking") },
      {
        cellText: String(unit.Price_Without_Parking),
        cellSubText: t("listings.stats.withoutParking"),
      },
    ]
  }
  if (unit.Price_With_Parking && !unit.Price_Without_Parking) {
    return [
      { cellText: String(unit.Price_With_Parking), cellSubText: t("listings.stats.withParking") },
    ]
  }
  if (!unit.Price_With_Parking && unit.Price_Without_Parking) {
    return [
      {
        cellText: String(unit.Price_Without_Parking),
        cellSubText: t("listings.stats.withoutParking"),
      },
    ]
  }
}

const buildSaleHoaDuesCellRow = (unit: RailsUnitWithOccupancyAndMinMaxIncome) => {
  if (unit?.HOA_Dues_With_Parking && unit?.HOA_Dues_Without_Parking) {
    return [
      { cellText: String(unit.HOA_Dues_With_Parking), cellSubText: t("listings.stats.withParking") },
      {
        cellText: String(unit.HOA_Dues_Without_Parking),
        cellSubText: t("listings.stats.withoutParking"),
      },
    ]
  }
  if (unit?.HOA_Dues_With_Parking && !unit?.HOA_Dues_Without_Parking) {
    return [
      { cellText: String(unit.HOA_Dues_With_Parking), cellSubText: t("listings.stats.withParking") },
    ]
  }
  if (!unit?.HOA_Dues_With_Parking && unit?.HOA_Dues_Without_Parking) {
    return [
      {
        cellText: String(unit.HOA_Dues_Without_Parking),
        cellSubText: t("listings.stats.withoutParking"),
      },
    ]
  }
}

const buildSaleCells = (unit: RailsUnitWithOccupancyAndMinMaxIncome) => ({
  units: {
    cellText: defaultIfNotTranslated(`listings.unitTypes.${unit.Unit_Type}`, unit.Unit_Type),
    cellSubText: `${unit?.Availability} ${t("t.available")}`,
  },
  income: {
    cellText: getRangeString(unit?.minMonthlyIncomeNeeded, unit?.maxMonthlyIncomeNeeded, true),
    cellSubText: t("t.perMonth"),
  },
  sale: buildSalePriceCellRow(unit),
  monthlyHoaDues: buildSaleHoaDuesCellRow(unit),
})

const buildRentalCells = (unit: RailsUnitWithOccupancyAndMinMaxIncome) => ({
  units: {
    cellText: defaultIfNotTranslated(`listings.unitTypes.${unit.Unit_Type}`, unit.Unit_Type),
    cellSubText: `${unit.Availability} ${t("t.available")}`,
  },
  income: {
    cellText: getRangeString(
      unit?.minMonthlyIncomeNeeded,
      unit?.maxMonthlyIncomeNeeded,
      true,
      undefined,
      !!unit?.Rent_percent_of_income
    ),
    cellSubText: t("t.perMonth"),
  },
  rent: {
    cellText: unit?.BMR_Rent_Monthly
      ? getCurrencyString(Math.round(unit?.BMR_Rent_Monthly))
      : `${unit?.Rent_percent_of_income}%`,
    cellSubText: unit?.BMR_Rent_Monthly ? t("t.perMonth") : t("t.income"),
  },
})

const buildHeader = (amiRow: AmiRow, showFullText: boolean): string => {
  const fullText: string = showFullText ? ".fullText" : ""
  return amiRow.ami.min
    ? t("listings.stats.amiRange".concat(fullText), {
        minAmiPercent: amiRow.ami.min,
        maxAmiPercent: amiRow.ami.max,
      })
    : t("listings.stats.upToPercentAmi".concat(fullText), { amiPercent: amiRow.ami.max })
}

const buildAccordions = (
  groupedUnitsByOccupancy: GroupedUnitsByOccupancy[],
  listingIsSale: boolean,
  forceZeroInRange: boolean
) => {
  return groupedUnitsByOccupancy?.map((occupancy, index, array) => {
    const accordionLength = array.length

    const categoryData = occupancy?.amiRows?.map((amiRow, amiRowIndex) => {
      const responsiveTableRows = amiRow.units.map((unit) =>
        listingIsSale ? buildSaleCells(unit) : buildRentalCells(unit)
      )

      const responsiveTableHeaders = listingIsSale
        ? {
            units: { name: "t.unitType" },
            income: { name: "shortFormNav.income" },
            sale: { name: "listings.stats.salesPrice" },
            monthlyHoaDues: { name: "listings.stats.monthlyHoaDues" },
          }
        : {
            units: { name: "t.unitType" },
            income: { name: "t.incomeRange" },
            rent: { name: "t.rent" },
          }

      // only add the AMI full text on the first accordion
      const header: string = buildHeader(amiRow, amiRowIndex === 0)

      return {
        header,
        tableData: { stackedData: responsiveTableRows, headers: responsiveTableHeaders },
      }
    })

    return (
      <ContentAccordion
        key={index}
        initialExpanded={accordionLength === 1}
        customBarContent={
          <span className="flex md:flex-row flex-col w-full justify-between items-start md:items-center">
            <span className="flex items-center whitespace-pre-wrap">
              <span className="text-sm md:text-2xl leading-8 font-semibold md:font-normal">
                {`${occupancy?.occupancy} `}
              </span>
              <span className="text-sm md:text-base text-left">
                {occupancy?.occupancy > 1
                  ? `${t("listings.stats.numInHouseholdPlural")}`
                  : `${t("listings.stats.numInHouseholdSingular")}`}
              </span>
            </span>
            <span className="flex items-center mr-2 text-sm md:text-base text-left md:text-center">
              {occupancy?.absoluteMinIncome <= 0 && !forceZeroInRange ? (
                <div>
                  {renderInlineMarkup(
                    t("listings.incomeRange.upToMaxPerMonth", {
                      max: occupancy?.absoluteMaxIncome?.toLocaleString(),
                    }),
                    "<span>"
                  )}
                </div>
              ) : (
                <div>
                  {renderInlineMarkup(
                    t("listings.incomeRange.minMaxPerMonth", {
                      min: Math.round(
                        forceZeroInRange ? 0 : occupancy?.absoluteMinIncome
                      ).toLocaleString(),
                      max: Math.round(occupancy?.absoluteMaxIncome).toLocaleString(),
                    }),
                    "<span>"
                  )}
                </div>
              )}
            </span>
          </span>
        }
        customExpandedContent={
          <div
            className={`p-4 border-2 border-gray-400 rounded-b-lg${listingIsSale ? " sale" : ""}`}
          >
            {/* The cell-row builders return optional sale/HOA columns; the @uic
                StackedTable cell typing is stricter than the runtime shape the
                Rails component also feeds it. Cast to the table's section type. */}
            <CategoryTable categoryData={categoryData as unknown as CategoryTableSection[]} />
          </div>
        }
        accordionTheme="gray"
      />
    )
  })
}

const buildHabitatText = (
  groupedUnitsByOccupancy: GroupedUnitsByOccupancy[],
  amiCharts: RailsAmiChart[]
) => {
  const habitatStringArray: string[] = []
  const minAmiChartsValues = amiCharts.find((chart) => chart.derivedFrom === "MinAmi")?.values
  const maxAmiChartsValues = amiCharts.find((chart) => chart.derivedFrom === "MaxAmi")?.values

  // groupedUnitsByOccupancy is already sorted; Habitat listings show 9 rows.
  const minOccupancy = groupedUnitsByOccupancy[0]?.occupancy
  const maxOccupancy = minOccupancy + 9

  for (let i = minOccupancy; i < maxOccupancy; i++) {
    const minOccupancyChart = minAmiChartsValues?.find((chart) => chart.numOfHousehold === i)
    const maxOccupancyChart = maxAmiChartsValues?.find((chart) => chart.numOfHousehold === i)

    if (minOccupancyChart && maxOccupancyChart) {
      habitatStringArray.push(
        t("listings.habitat.incomeRange", {
          smart_count: i,
          minIncome: minOccupancyChart?.amount?.toLocaleString(),
          maxIncome: maxOccupancyChart?.amount?.toLocaleString(),
        })
      )
    }
  }

  return (
    <div className="md:pr-8 md:w-2/3 mx-2 w-full">
      <ul>
        {habitatStringArray.map((habitatString, index) => (
          <li key={index}>
            <p>{habitatString}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface PricingTableProps {
  listing: SerializableListing
  units: SerializableUnit[]
  amiCharts: SerializableAmiChart[]
}

export function PricingTable({ listing, units, amiCharts }: PricingTableProps) {
  // Helpers operate on the raw Rails shapes, which these serializable objects
  // carry at runtime (index signatures preserve the Salesforce fields).
  const railsListing = listing as unknown as RailsListing
  const railsUnits = units as unknown as RailsUnit[]
  const railsAmiCharts = amiCharts as unknown as RailsAmiChart[]

  const listingIsSale = isSale(railsListing)
  const listingIsHabitat = isHabitatListing(railsListing)

  const availableUnits = listingIsSale ? filterAvailableUnits(railsUnits) : railsUnits
  const forceZeroInRange = !!availableUnits?.some((unit) => unit.Rent_percent_of_income)

  let groupedUnitsByOccupancy: GroupedUnitsByOccupancy[] = []
  if (availableUnits?.length) {
    groupedUnitsByOccupancy = groupAndSortUnitsByOccupancy(
      availableUnits,
      railsAmiCharts,
      listingIsSale
    )
  }

  if (!groupedUnitsByOccupancy.length) return null

  if (listingIsHabitat) {
    return buildHabitatText(groupedUnitsByOccupancy, railsAmiCharts)
  }

  return (
    <div className="md:my-6 md:pr-8 sm:px-4 lg:pl-0 lg:pr-8 md:w-2/3 px-2 w-full">
      {buildAccordions(groupedUnitsByOccupancy, listingIsSale, forceZeroInRange)}
    </div>
  )
}
