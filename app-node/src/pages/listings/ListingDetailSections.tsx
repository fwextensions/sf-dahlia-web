/**
 * Additional listing-detail sections ported from the Rails react-on-rails
 * components so the native app-node listing page reaches parity:
 *   - Household Maximum Income (AMI) table
 *   - Occupancy table
 *   - Rental Assistance
 *   - Additional Eligibility Rules (credit / rental / criminal history)
 *   - Features (property features + unit accordions + additional fees)
 *   - Neighborhood (map)
 *   - Additional Information (special notes / required docs / program rules)
 *   - Mailing-list signup
 *
 * Data comes from props (the route loader / deferred promises) rather than the
 * Rails ListingDetailsContext. listingUtil helpers are SSR-safe here (they only
 * touch `window` inside function bodies that we don't call during render) —
 * PricingTable already imports from it the same way.
 *
 * Machine-translated Salesforce copy (getTranslatedString) is intentionally not
 * wired: the native route renders the English page, for which getTranslatedString
 * returns the original value anyway.
 */
import { useState } from "react"
import {
  ActionBlock,
  AdditionalFees,
  Button,
  ContentAccordion,
  Description,
  ExpandableText,
  Heading,
  Icon,
  InfoCard,
  LinkButton,
  ListSection,
  ListingDetailItem,
  StandardTable,
  t,
} from "@uic"
import {
  getMinMaxOccupancy,
  getPriorityTypeText,
  filterAvailableUnits,
  isBMR,
  isRental,
  isSale,
} from "../../../../app/javascript/util/listingUtil"
import { renderMarkup } from "../../../../app/javascript/util/languageUtil"
import { stripMostTags } from "../../../../app/javascript/util/filterUtil"
import type RailsUnit from "../../../../app/javascript/api/types/rails/listings/RailsUnit"
import type { RailsAmiChart, RailsAmiChartValue } from "../../../../app/javascript/api/types/rails/listings/RailsAmiChart"
import type { SerializableAmiChart, SerializableListing, SerializableUnit } from "../../lib/listings/server-fns"

// Raw Salesforce fields present at runtime but not on SerializableListing.
const raw = (l: SerializableListing): Record<string, unknown> =>
  l as unknown as Record<string, unknown>
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v))

// listingUtil predicates are typed against the full Rails listing; the native
// page only carries the serializable subset, so cast at the boundary.
type RailsListingArg = Parameters<typeof isSale>[0]
const rl = (l: SerializableListing): RailsListingArg => l as unknown as RailsListingArg
type TableData = Parameters<typeof StandardTable>[0]["data"]

// ─── Occupancy ────────────────────────────────────────────────────────────────

interface UnitSummary {
  unitType: string
  minOccupancy?: number | null
  maxOccupancy?: number | null
}

export function OccupancyTable({ listing }: { listing: SerializableListing }) {
  const summaries = (raw(listing).unitSummaries as { general?: UnitSummary[] } | undefined)?.general
  if (!summaries?.length) return null

  const data = summaries.map((unit) => {
    let occupancyLabel = ""
    if (unit.maxOccupancy === 1) {
      occupancyLabel = t("listings.onePerson")
    } else if (unit.minOccupancy && unit.maxOccupancy) {
      occupancyLabel = t("listings.minMaxPeople", { min: unit.minOccupancy, max: unit.maxOccupancy })
    } else if (unit.minOccupancy && !unit.maxOccupancy) {
      occupancyLabel = t("listings.minPeople", { num: unit.minOccupancy })
    }
    return {
      unitType: {
        content: <span className="font-semibold">{t(`listings.unitTypes.${unit.unitType}`)}</span>,
      },
      occupancy: { content: occupancyLabel },
    }
  })

  return (
    <ListSection
      title={t("t.occupancy")}
      subtitle={isSale(rl(listing)) ? t("listings.occupancyDescriptionMinOne") : t("listings.occupancyDescriptionNoSro")}
    >
      <StandardTable headers={{ unitType: "t.unitType", occupancy: "t.occupancy" }} data={data} />
    </ListSection>
  )
}

// ─── Household Maximum Income (AMI) table ─────────────────────────────────────
// Pure helpers copied verbatim from ListingDetailsHMITable.

const hasMultiplePercents = (charts: RailsAmiChart[]) =>
  charts.map((c) => c.percent).filter((p, i, all) => all.indexOf(p) === i).length > 1

const buildHmiHeaders = (charts: RailsAmiChart[]): Record<string, string> => {
  if (!hasMultiplePercents(charts)) {
    return {
      householdSize: "t.householdSize",
      maxIncomeMonth: "t.maximumIncomeMonth",
      maxIncomeYear: "t.maximumIncomeYear",
    }
  }
  const headers: Record<string, string> = { householdSize: "t.householdSize" }
  charts.forEach((c) => {
    headers[`ami${c.percent}`] = `t.percentAMI*percent:${c.percent}`
  })
  return headers
}

const householdSizeCell = (i: number) => ({
  content: (
    <span className="font-semibold">
      {i === 1 ? t("listings.onePerson") : `${i} ${t("listings.people")}`}
    </span>
  ),
})

const buildHmiData = (
  listingIsSale: boolean,
  charts: RailsAmiChart[],
  minOccupancy: number,
  maxOccupancy: number
) => {
  const max = listingIsSale ? maxOccupancy : maxOccupancy + 2
  const rows: Record<string, unknown>[] = []
  if (hasMultiplePercents(charts)) {
    for (let i = minOccupancy; i <= max; i++) {
      const row: Record<string, unknown> = { householdSize: householdSizeCell(i) }
      charts.forEach((chart) => {
        const value = chart.values?.find((v: RailsAmiChartValue) => v.numOfHousehold === i)
        if (value) {
          row[`ami${chart.percent}`] = {
            content: t("t.perYearCost", { cost: `$${value.amount?.toLocaleString()}` }),
          }
        }
      })
      rows.push(row)
    }
  } else {
    const recent = charts[charts.length - 1]
    for (let i = minOccupancy; i <= max; i++) {
      const value = recent?.values?.find((v: RailsAmiChartValue) => v.numOfHousehold === i)
      if (value) {
        rows.push({
          householdSize: householdSizeCell(i),
          maxIncomeMonth: {
            content: t("t.perMonthCost", { cost: `$${Math.floor(value.amount / 12).toLocaleString()}` }),
          },
          maxIncomeYear: {
            content: t("t.perYearCost", { cost: `$${value.amount?.toLocaleString()}` }),
          },
        })
      }
    }
  }
  return rows
}

const showHmiToggle = (maxOccupancy: number, minOccupancy: number, cutoff: number): boolean =>
  !!maxOccupancy && maxOccupancy + 2 - minOccupancy > cutoff

export function HouseholdMaxIncomeTable({
  listing,
  units,
  amiCharts,
}: {
  listing: SerializableListing
  units: SerializableUnit[]
  amiCharts: SerializableAmiChart[]
}) {
  const [collapsed, setCollapsed] = useState(true)
  const charts = ([...amiCharts] as unknown as RailsAmiChart[]).sort(
    (a, b) => Number(a.percent) - Number(b.percent)
  )
  if (!charts.length || !units.length) return null

  const { minOccupancy, maxOccupancy, explicitMaxOccupancy } = getMinMaxOccupancy(
    units as unknown as RailsUnit[],
    charts
  )
  if (minOccupancy == null || maxOccupancy == null) return null

  const headers = buildHmiHeaders(charts)
  const data = buildHmiData(isSale(rl(listing)), charts, minOccupancy, maxOccupancy)
  const cutoff = explicitMaxOccupancy ? Math.max(Math.floor(maxOccupancy / 2) * 2, 1) : 2

  return (
    <ListSection
      title={t("listings.householdMaximumIncome")}
      subtitle={
        <div>
          <div className="mb-4">{renderMarkup(t("listings.forIncomeCalculations"))}</div>
          <ul className="list-disc ml-5">
            <li>{t("listings.incomeExceptions.students")}</li>
            <li>{t("listings.incomeExceptions.nontaxable")}</li>
          </ul>
        </div>
      }
    >
      <StandardTable
        headers={headers}
        data={(collapsed ? data.slice(0, cutoff) : data) as TableData}
      />
      {showHmiToggle(maxOccupancy, minOccupancy, cutoff) && (
        <Button
          className="font-medium md:bg-primary-lighter mt-3 text-primary-dark"
          onClick={() => setCollapsed((c) => !c)}
          ariaLabel={t("listings.householdMaximumIncome.showMore.aria")}
          ariaExpanded={!collapsed}
        >
          {collapsed ? t("label.showMore") : t("label.showLess")}
        </Button>
      )}
    </ListSection>
  )
}

// ─── Rental Assistance ────────────────────────────────────────────────────────

export function RentalAssistance({ listing }: { listing: SerializableListing }) {
  if (!isRental(rl(listing))) return null
  return (
    <ListSection
      title={t("listingsForRent.rentalAssistance.title")}
      subtitle={
        <>
          <div className="mb-4">{t("listingsForRent.rentalAssistance.info1")}</div>
          <div>{t("listingsForRent.rentalAssistance.info2")}</div>
        </>
      }
    />
  )
}

// ─── Additional Eligibility Rules ─────────────────────────────────────────────

export function AdditionalEligibilityRules({ listing }: { listing: SerializableListing }) {
  const r = raw(listing)
  const credit = str(r.Credit_Rating)
  const eviction = str(r.Eviction_History)
  const criminal = str(r.Criminal_History)
  const buildingSelection = str(r.Building_Selection_Criteria)
  if (!credit && !eviction && !criminal) return null

  return (
    <ListSection
      title={t("listings.additionalEligibilityRules.title")}
      subtitle={t("listings.additionalEligibilityRules.subtitle")}
    >
      {credit && (
        <InfoCard title={t("listings.additionalEligibilityRules.creditHistory")}>
          <ExpandableText
            className="text-xs text-gray-700 translate additional-rule-card"
            strings={{
              readMore: t("label.showMore"),
              readLess: t("label.showLess"),
              buttonAriaLabel: t("listings.eligibility.guidelines.creditHistory"),
            }}
            buttonClassName="mt-2 has-toggle"
          >
            {stripMostTags(credit)}
          </ExpandableText>
        </InfoCard>
      )}
      {eviction && (
        <InfoCard title={t("listings.additionalEligibilityRules.rentalHistory")}>
          <ExpandableText
            className="text-xs text-gray-700 translate additional-rule-card"
            strings={{
              readMore: t("label.showMore"),
              readLess: t("label.showLess"),
              buttonAriaLabel: t("listings.eligibility.guidelines.rentalHistory"),
            }}
            buttonClassName="mt-2 has-toggle"
          >
            {stripMostTags(eviction)}
          </ExpandableText>
        </InfoCard>
      )}
      <InfoCard title={t("listings.additionalEligibilityRules.criminalBackground")}>
        <ExpandableText
          className="text-xs text-gray-700 additional-rule-card"
          strings={{
            readMore: t("label.showMore"),
            readLess: t("label.showLess"),
            buttonAriaLabel: t("listings.eligibility.guidelines.criminalBackground"),
          }}
          maxLength={600}
        >
          {t("listings.additionalEligibilityRules.criminalBackgroundInfo", {
            fairChanceUrl: "https://sfgov.org/olse/fair-chance-ordinance-fco",
            article49Url:
              "https://sfgov.org/olse/sites/default/files/FileCenter/Documents/12136-FCO%20FAQs%20Final.pdf",
          })}
        </ExpandableText>
      </InfoCard>
      {buildingSelection && (
        <p>
          <a href={buildingSelection} target="_blank" rel="noopener noreferrer" className="md:text-blue-700">
            {t("listings.additionalEligibilityRules.findOutMore")}
          </a>
        </p>
      )}
    </ListSection>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

function FeatureItem({ content, title }: { content: unknown; title: string }) {
  const text = str(content)
  if (!text) return null
  return (
    <Description
      term={title}
      description={stripMostTags(text)}
      markdownProps={{ disableParsingRawHTML: false }}
      markdown={true}
    />
  )
}

function UnitAccordions({ units, isSaleListing }: { units: SerializableUnit[]; isSaleListing: boolean }) {
  const rawUnits = units as unknown as RailsUnit[]
  const available = isSaleListing ? filterAvailableUnits(rawUnits) : rawUnits

  const byType = available.reduce<Record<string, { units: RailsUnit[]; availability: number; minSqFt: number; maxSqFt: number }>>(
    (acc, unit) => {
      const type = unit.Unit_Type
      const sqft = unit.Unit_Square_Footage ?? 0
      if (!acc[type]) {
        acc[type] = { units: [], availability: 0, minSqFt: sqft, maxSqFt: sqft }
      }
      acc[type].units.push(unit)
      acc[type].availability++
      if (sqft < acc[type].minSqFt) acc[type].minSqFt = sqft
      if (sqft > acc[type].maxSqFt) acc[type].maxSqFt = sqft
      return acc
    },
    {}
  )

  const headers = {
    unit: "listings.features.unit",
    area: "listings.features.area",
    baths: "listings.features.baths",
    floor: "listings.features.floor",
    accessibility: "listings.features.accessibility",
  }

  return (
    <>
      {Object.keys(byType).map((type) => {
        const group = byType[type]
        const data = group.units.map((unit) => ({
          unit: { content: <span className="font-semibold">{unit.Unit_Number}</span> },
          area: {
            content: (
              <div className="whitespace-nowrap">
                <span className="font-semibold">{unit.Unit_Square_Footage}</span>{" "}
                <span aria-hidden="true">{t("listings.features.sqft")}</span>
                <span className="sr-only">{t("listings.features.squareFeet")}</span>
              </div>
            ),
          },
          baths: { content: <span className="font-semibold">{unit.Number_of_Bathrooms}</span> },
          floor: { content: <span className="font-semibold">{unit.Unit_Floor}</span> },
          accessibility: {
            content: (
              <span className="font-semibold">
                {unit.Priority_Type && getPriorityTypeText(unit.Priority_Type)}
              </span>
            ),
          },
        }))
        return (
          <ContentAccordion
            key={type}
            accordionTheme="blue"
            customBarContent={
              <h3 className="toggle-header-content">
                <strong>{t(`listings.unitTypes.${type}`)}</strong>:&nbsp;
                {`${group.availability} ${
                  group.availability === 1
                    ? t("listings.features.unit").toLowerCase()
                    : t("t.units").toLowerCase()
                }, ${group.minSqFt === group.maxSqFt ? group.minSqFt : `${group.minSqFt} - ${group.maxSqFt}`} ${t(
                  "listings.features.squareFeet"
                )}`}
              </h3>
            }
            customExpandedContent={
              <div>
                <StandardTable headers={headers} data={data} />
              </div>
            }
          />
        )
      })}
    </>
  )
}

const depositString = (min?: string, max?: string) => {
  if (!min && !max) return null
  if (min && max) return `$${min} - $${max}`
  return min ? `$${min}` : `$${max}`
}

export function FeaturesSection({
  listing,
  units,
  imageSrc = "",
}: {
  listing: SerializableListing
  units: SerializableUnit[]
  imageSrc?: string
}) {
  const r = raw(listing)
  const rental = isRental(rl(listing))
  const sale = isSale(rl(listing))
  const depositSubtext = [t("listings.features.orOneMonthsRent")]
  if (isBMR(rl(listing))) depositSubtext.push(t("listings.features.mayBeHigherForLowerCreditScores"))

  const depositMin = r.Deposit_Min as number | undefined
  const depositMax = r.Deposit_Max as number | undefined
  const fee = r.Fee as number | undefined

  return (
    <ListingDetailItem
      imageAlt=""
      imageSrc={imageSrc}
      title={t("listings.features.header")}
      subtitle={sale ? t("listings.features.saleSubheader") : t("listings.features.rentSubheader")}
    >
      <div className="listing-detail-panel">
        <dl className="column-definition-list">
          <FeatureItem content={r.Neighborhood} title={t("listings.neighborhood.header")} />
          <FeatureItem content={r.Year_Built} title={t("listings.features.built")} />
          <FeatureItem content={r.Appliances} title={t("listings.features.appliances")} />
          <FeatureItem
            content={r.Services_Onsite}
            title={t(sale ? "listings.features.servicesCoveredByHoaDues" : "listings.features.servicesOnsite")}
          />
          <FeatureItem content={r.Parking_Information} title={t("listings.features.parking")} />
          {rental && <FeatureItem content={r.Utilities} title={t("listings.features.utilities")} />}
          <FeatureItem content={r.Smoking_Policy} title={t("listings.features.smokingPolicy")} />
          <FeatureItem content={r.Pet_Policy} title={t("listings.features.petsPolicy")} />
          <FeatureItem content={r.Amenities} title={t("listings.features.propertyAmenities")} />
          <FeatureItem content={r.Accessibility} title={t("listings.features.accessibility")} />
          {rental && <Description term={t("listings.features.unitFeatures")} description="" />}
        </dl>
        {units.length > 0 && <UnitAccordions units={units} isSaleListing={sale} />}
        {rental && (
          <AdditionalFees
            deposit={depositString(depositMin?.toLocaleString(), depositMax?.toLocaleString()) ?? undefined}
            applicationFee={fee ? `$${fee.toFixed(2)?.toLocaleString()}` : undefined}
            footerContent={
              r.Costs_Not_Included
                ? [
                    <span className="translate" key="costs">
                      {renderMarkup(str(r.Costs_Not_Included))}
                    </span>,
                  ]
                : undefined
            }
            strings={{
              sectionHeader: t("listings.features.additionalFees"),
              deposit: t("listings.features.deposit"),
              depositSubtext,
              applicationFee: t("listings.features.applicationFee"),
              applicationFeeSubtext: [
                t("listings.features.perApplicant"),
                t("listings.features.duePostLottery"),
              ],
            }}
          />
        )}
      </div>
    </ListingDetailItem>
  )
}

// ─── Neighborhood ─────────────────────────────────────────────────────────────

export function NeighborhoodSection({
  listing,
  imageSrc = "",
}: {
  listing: SerializableListing
  imageSrc?: string
}) {
  const r = raw(listing)
  const address = [r.Building_Street_Address, r.Building_City, r.Building_State, r.Building_Zip_Code]
    .map(str)
    .filter(Boolean)
    .join(", ")
  // Without a Maps API key the embed renders a blank 450px box; skip the section
  // entirely so it doesn't leave a large empty gap. (Rails always shows it because
  // GOOGLE_PLACES_KEY is configured in that environment.)
  if (!address || !process.env.GOOGLE_PLACES_KEY) return null

  const iframeUrl = `https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_PLACES_KEY}&q=${encodeURIComponent(
    address
  )}&language=en`

  return (
    <ListingDetailItem
      desktopClass="bg-primary-lighter"
      imageAlt=""
      imageSrc={imageSrc}
      title={t("listings.neighborhood.header")}
      subtitle={t("listings.neighborhood.subheader")}
    >
      <iframe
        className="md:mb-6 md:pl-16 pl-0"
        src={iframeUrl}
        title={t("listings.neighborhood.mapTitle", { listingAddress: address })}
        width="100%"
        height="450"
      />
    </ListingDetailItem>
  )
}

// ─── Additional Information ───────────────────────────────────────────────────

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="info-card bg-gray-100 border-0">
      <h3 className="text-serif-xl">{title}</h3>
      <div className="text-xs translate">{children}</div>
    </div>
  )
}

export function AdditionalInfoSection({
  listing,
  imageSrc = "",
}: {
  listing: SerializableListing
  imageSrc?: string
}) {
  const r = raw(listing)
  const otherNotes = str(r.Listing_Other_Notes)
  const requiredDocs = str(r.Required_Documents)
  const legal = str(r.Legal_Disclaimers)
  const ccAndRUrl = str(r.CC_and_R_URL)
  const repricing = str(r.Repricing_Mechanism)

  return (
    <ListingDetailItem
      imageAlt=""
      imageSrc={imageSrc}
      title={t("listings.additionalInformation.header")}
      subtitle={t("listings.additionalInformation.subheader")}
    >
      <div className="listing-detail-panel">
        {otherNotes && <InfoBlock title={t("listings.specialNotes")}>{renderMarkup(stripMostTags(otherNotes))}</InfoBlock>}
        {requiredDocs && (
          <InfoBlock title={t("listings.requiredDocuments")}>{renderMarkup(stripMostTags(requiredDocs))}</InfoBlock>
        )}
        {legal && (
          <InfoBlock title={t("listings.importantProgramRules")}>{renderMarkup(stripMostTags(legal))}</InfoBlock>
        )}
        {ccAndRUrl && (
          <InfoBlock title={t("listings.cc&r")}>
            {t("listings.cc&rDescription")}
            <br />
            <LinkButton href={ccAndRUrl} className="mt-4" newTab>
              {t("listings.downloadPdf")}
            </LinkButton>
          </InfoBlock>
        )}
        {repricing && (
          <InfoBlock title={t("listings.rePricing")}>{renderMarkup(stripMostTags(repricing))}</InfoBlock>
        )}
      </div>
    </ListingDetailItem>
  )
}

// ─── Mailing-list signup ──────────────────────────────────────────────────────

const LISTINGS_ALERT_URL = "https://confirmsubscription.com/h/y/C3BAFCD742D47910"

export function MailingListSignup() {
  return (
    <ActionBlock
      className="mt-4"
      header={<Heading priority={2}>{t("welcome.newListingEmailAlert")}</Heading>}
      background="primary-lighter"
      icon={<Icon size="3xl" symbol="mailThin" fill="transparent" />}
      actions={[
        <a className="button" key="action-1" href={LISTINGS_ALERT_URL} target="_blank" rel="noopener noreferrer">
          {t("welcome.signUpToday")}
        </a>,
      ]}
    />
  )
}
