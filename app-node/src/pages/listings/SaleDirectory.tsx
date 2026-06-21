/**
 * SaleDirectory page component.
 *
 * Renders the ownership/for-sale listings directory using Bloom UI components.
 * Data is pre-loaded server-side via the route loader — no client-side API calls.
 */
import {
  ActionBlock,
  ActionBlockLayout,
  Heading,
  Icon,
  t,
} from "@uic"
import dayjs from "dayjs"
import type { SerializableListing } from "../../lib/listings/server-fns"
import type RailsSaleListing from "../../../../app/javascript/api/types/rails/listings/RailsSaleListing"
import {
  getListingCards as getRailsListingCards,
  getRangeString,
  getAvailabilityString,
  getMinMax,
  type StackedDataFxnType,
} from "../../../../app/javascript/modules/listings/DirectoryHelpers"
import { defaultIfNotTranslated } from "../../../../app/javascript/util/languageUtil"
import {
  BeforeApplyingForSale,
  BeforeApplyingType,
} from "../../../../app/javascript/components/BeforeApplyingForSale"
import { renderInlineMarkup } from "../../../../app/javascript/util/languageUtil"
import { getFlag, FLAGS } from "../../lib/flags/store"
import { useState } from "react"
import { ListingsGroupHeader } from "./components/ListingsGroupHeader"
import { ListingsGroup } from "./components/ListingsGroup"
import { EmptyListingsView } from "./components/EmptyListingsView"
import { DirectorySectionNav } from "./components/DirectorySectionNav"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListingsGroups {
  open: SerializableListing[]
  fcfs: SerializableListing[]
  upcoming: SerializableListing[]
  results: SerializableListing[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isFcfsSalesListing(listing: SerializableListing): boolean {
  const isSale = listing.Tenure === "New sale" || listing.Tenure === "Resale"
  return isSale && listing.Status === "Active" && !!listing.Application_Start_Date_Time
}

function sortListings(listings: SerializableListing[]): ListingsGroups {
  const open: SerializableListing[] = []
  const fcfs: SerializableListing[] = []
  const upcoming: SerializableListing[] = []
  const results: SerializableListing[] = []

  listings.forEach((listing) => {
    if (isFcfsSalesListing(listing)) {
      fcfs.push(listing)
    } else if (listing.Application_Due_Date && dayjs(listing.Application_Due_Date) > dayjs()) {
      open.push(listing)
    } else if (listing.Lottery_Status === "Lottery Complete") {
      results.push(listing)
    } else {
      upcoming.push(listing)
    }
  })

  open.sort((a, b) => {
    if (!a.Application_Due_Date) return 1
    if (!b.Application_Due_Date) return -1
    return new Date(a.Application_Due_Date) > new Date(b.Application_Due_Date) ? 1 : -1
  })
  upcoming.sort((a, b) => {
    if (!a.Application_Due_Date) return 1
    if (!b.Application_Due_Date) return -1
    return new Date(a.Application_Due_Date) < new Date(b.Application_Due_Date) ? 1 : -1
  })
  results.sort((a, b) => {
    if (!a.Lottery_Results_Date) return 1
    if (!b.Lottery_Results_Date) return -1
    return new Date(a.Lottery_Results_Date) < new Date(b.Lottery_Results_Date) ? 1 : -1
  })

  return { open, fcfs, upcoming, results }
}

// Builds the "Available Units" stacked-table rows for sales listings
// (units / AMI / HOA dues / price) from the listing's unitSummaries. Mirrors
// getForSaleSummaryTable in app/javascript/pages/listings/for-sale.tsx.
const getForSaleSummaryTable: StackedDataFxnType = (listing: RailsSaleListing) => {
  const summary = listing.unitSummaries.general ?? listing.unitSummaries.reserved
  if (!summary) return []
  // Rounded $ range from the without/with-parking min & max pair (matches Rails;
  // getMinMax/getRangeString tolerate nulls, defaulting to 0 / "").
  const roundedRange = (
    minA: number | null | undefined,
    minB: number | null | undefined,
    maxA: number | null | undefined,
    maxB: number | null | undefined
  ) =>
    getRangeString(
      Math.round(getMinMax(minA ?? null, minB ?? null, "min") ?? 0),
      Math.round(getMinMax(maxA ?? null, maxB ?? null, "max") ?? 0),
      true
    ) ?? ""
  return summary
    .filter((s) => !!s.unitType)
    .map((s) => ({
      unitType: {
        cellText: defaultIfNotTranslated(`listings.unitTypes.${s.unitType}`, s.unitType),
        cellSubText: getAvailabilityString(listing, s),
        hideMobile: true,
      },
      income: {
        cellText: s.maxQualifyingAMI
          ? t("listings.stats.upToPercent", { amiPercent: s.maxQualifyingAMI.toString() })
          : "",
        cellSubText: s.maxQualifyingAMI ? t("listings.stats.upToPercent.p2") : "",
      },
      colThree: {
        cellText: roundedRange(
          s.minHoaDuesWithoutParking,
          s.minHoaDuesWithParking,
          s.maxHoaDuesWithoutParking,
          s.maxHoaDuesWithParking
        ),
        cellSubText: t("t.perMonth"),
      },
      colFour: {
        cellText: roundedRange(
          s.minPriceWithoutParking,
          s.minPriceWithParking,
          s.maxPriceWithoutParking,
          s.maxPriceWithParking
        ),
      },
    }))
}

// Reuse the Rails directory card renderer so cards match production exactly:
// image, tags, status bars, and the "Available Units" stacked unit table with
// its priority-units subheader. The native data is the raw Salesforce shape the
// Rails helpers expect.
function getListingCards(listings: SerializableListing[]): JSX.Element[] {
  return getRailsListingCards(
    listings as unknown as RailsSaleListing[],
    "forSale",
    getForSaleSummaryTable
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FindMoreActionBlock() {
  return (
    <div className="bg-primary-darker sale-directory">
      <div className="max-w-5xl mx-auto p-2 md:p-4">
        <ActionBlock
          header={<Heading priority={2}>{t("saleDirectory.callout.title")}</Heading>}
          background="primary-darker"
          layout={ActionBlockLayout.inline}
          actions={[
            <a
              className="button ml-8"
              key="action-1"
              href="https://www.sf.gov/reports--december-2024--city-second-program-current-listings"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("saleDirectory.callout.citySecondLoan")}
            </a>,
          ]}
        />
      </div>
    </div>
  )
}

// DALP (Downpayment Assistance Loan Program) header block, shown in the
// directory header when the directory.dalp flag is on. Ported from the local
// DalpHeader in app/javascript/modules/listings/BuyHeader.tsx.
function DalpHeader() {
  return (
    <div className="md:bg-white md:p-4">
      <Heading styleType="underlineWeighted" className="mb-5" priority={2}>
        {t("saleDirectory.dalp.title")}
      </Heading>
      <p className="mb-4">{t("saleDirectory.dalp.content")}</p>
      <p className="font-bold">{t("saleDirectory.dalp.subtitle")}</p>
      <p className="mb-4">{t("saleDirectory.dalp.subcontent")}</p>
      <p className="mb-4">
        {renderInlineMarkup(
          t("saleDirectory.dalp.link", {
            url: "https://www.sf.gov/apply-downpayment-loan-buy-market-rate-home",
          })
        )}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SaleDirectoryProps {
  listings: SerializableListing[]
}

export function SaleDirectory({ listings }: SaleDirectoryProps) {
  const { open, fcfs, upcoming, results } = sortListings(listings)
  // Collapsible sections start closed; the nav bar expands them on click.
  const [upcomingOpen, setUpcomingOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)

  const handleNavigate = (sectionKey: string) => {
    if (sectionKey === "upcoming") setUpcomingOpen(true)
    if (sectionKey === "results") setResultsOpen(true)
  }

  return (
    <div>
      {/* id="page-header" is observed by the section nav for sticky/scroll-spy. */}
      <div id="page-header" className="page-header">
        <div className="buy-header_columns max-w-5xl mx-auto px-6 py-8">
          <Heading className="buy-header_title buy-header_left_col">
            {t("saleDirectory.title")}
          </Heading>
          <div className="mb-8 buy-header_right_col">
            <a href="#nav-bar-container" className="button is-primary is-fullwidth">
              {t("saleDirectory.seeHomesForSale")}
            </a>
          </div>
          <div className="buy-header_left_col">
            <BeforeApplyingForSale beforeApplyingType={BeforeApplyingType.DIRECTORY} />
          </div>
          {getFlag(FLAGS.DIRECTORY_DALP) && (
            <div className="buy-header_right_col">
              <DalpHeader />
            </div>
          )}
        </div>
      </div>

      <DirectorySectionNav
        directoryType="forSale"
        groups={{ open, fcfs, upcoming, results }}
        onNavigate={handleNavigate}
      />

      <div id="listing-results">
        {/* Open lottery listings */}
        <ListingsGroupHeader
          title={t("listings.forSale.openListings.title")}
          subtitle={t("listings.forSale.openListings.subtitle")}
          icon={<Icon size="xlarge" symbol="house" />}
          refKey="enter-a-lottery"
        >
          {open.length > 0 ? (
            getListingCards(open)
          ) : (
            <EmptyListingsView
              section="openLotteries"
              directoryType="forSale"
              listingsCount={fcfs.length}
            />
          )}
        </ListingsGroupHeader>

        {/* First-come, first-served listings */}
        <ListingsGroupHeader
          title={t("listings.forSale.fcfsListings.title")}
          subtitle={t("listings.forSale.fcfsListings.subtitle.v2")}
          icon={<Icon size="xlarge" symbol="house" />}
          refKey="buy-now"
        >
          {fcfs.length > 0 ? (
            getListingCards(fcfs)
          ) : (
            <EmptyListingsView
              section="fcfsListings"
              directoryType="forSale"
              listingsCount={open.length}
            />
          )}
        </ListingsGroupHeader>

        <FindMoreActionBlock />

        {/* Upcoming lotteries */}
        <ListingsGroup
          listingsCount={upcoming.length}
          header={t("listings.upcomingLotteries.title")}
          hideButtonText={t("listings.upcomingLotteries.hide")}
          showButtonText={t("listings.upcomingLotteries.show")}
          info={t("listings.upcomingLotteries.subtitle")}
          refKey="upcoming-lotteries"
          open={upcomingOpen}
          onToggle={() => setUpcomingOpen((v) => !v)}
        >
          {upcoming.length > 0 ? (
            getListingCards(upcoming)
          ) : (
            <EmptyListingsView section="upcomingLotteries" directoryType="forSale" />
          )}
        </ListingsGroup>

        {/* Lottery results */}
        <ListingsGroup
          listingsCount={results.length}
          header={t("listings.lotteryResults.title")}
          hideButtonText={t("listings.lotteryResults.hide")}
          showButtonText={t("listings.lotteryResults.show")}
          info={t("listings.lotteryResults.subtitle")}
          icon="result"
          refKey="lottery-results"
          open={resultsOpen}
          onToggle={() => setResultsOpen((v) => !v)}
        >
          {results.length > 0 ? (
            getListingCards(results)
          ) : (
            <EmptyListingsView section="lotteryResults" directoryType="forSale" />
          )}
        </ListingsGroup>
      </div>
    </div>
  )
}
