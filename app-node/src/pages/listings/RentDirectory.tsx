/**
 * RentDirectory page component.
 *
 * Renders the rental listings directory using Bloom UI components.
 * Data is pre-loaded server-side via the route loader — no client-side API calls.
 */
import {
  ActionBlock,
  ActionBlockLayout,
  Heading,
  Icon,
  LinkButton,
  PageHeader,
  t,
} from "@uic"
import dayjs from "dayjs"
import type { SerializableListing } from "../../lib/listings/server-fns"
import type RailsRentalListing from "../../../../app/javascript/api/types/rails/listings/RailsRentalListing"
import {
  getListingCards as getRailsListingCards,
  getRangeString,
  getRentRangeString,
  getRentSubText,
  getAvailabilityString,
  type StackedDataFxnType,
} from "../../../../app/javascript/modules/listings/DirectoryHelpers"
import { defaultIfNotTranslated } from "../../../../app/javascript/util/languageUtil"
import { useState } from "react"
import { ListingsGroupHeader } from "./components/ListingsGroupHeader"
import { ListingsGroup } from "./components/ListingsGroup"
import { EmptyListingsView } from "./components/EmptyListingsView"
import { DirectorySectionNav } from "./components/DirectorySectionNav"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListingsGroups {
  open: SerializableListing[]
  upcoming: SerializableListing[]
  results: SerializableListing[]
  additional: SerializableListing[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sortListings(listings: SerializableListing[]): ListingsGroups {
  const open: SerializableListing[] = []
  const upcoming: SerializableListing[] = []
  const results: SerializableListing[] = []
  const additional: SerializableListing[] = []

  listings.forEach((listing) => {
    if (listing.Application_Due_Date && dayjs(listing.Application_Due_Date) > dayjs()) {
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

  return { open, upcoming, results, additional }
}

// Builds the "Available Units" stacked-table rows (units / income range / rent)
// from the listing's unitSummaries. Mirrors getForRentSummaryTable in
// app/javascript/pages/listings/for-rent.tsx.
const getForRentSummaryTable: StackedDataFxnType = (listing: RailsRentalListing) => {
  const summary = listing.unitSummaries.general ?? listing.unitSummaries.reserved
  if (!summary) return []
  return summary
    .filter((s) => !!s.unitType)
    .map((s) => ({
      unitType: {
        cellText: defaultIfNotTranslated(`listings.unitTypes.${s.unitType}`, s.unitType),
        cellSubText: getAvailabilityString(listing, s),
        hideMobile: true,
      },
      colThree: {
        cellText: getRangeString(s.absoluteMinIncome || 0, s.absoluteMaxIncome, true) ?? "",
        cellSubText: t("t.perMonth"),
      },
      colFour: { cellText: getRentRangeString(s), cellSubText: getRentSubText(s) ?? "" },
    }))
}

// Reuse the Rails directory card renderer so cards match production exactly:
// image, tags, status bars, and the "Available Units" stacked unit table with
// its priority-units subheader. The native data is the raw Salesforce shape the
// Rails helpers expect.
function getListingCards(listings: SerializableListing[]): JSX.Element[] {
  return getRailsListingCards(
    listings as unknown as RailsRentalListing[],
    "forRent",
    getForRentSummaryTable
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FindMoreActionBlock() {
  return (
    <div className="bg-primary-darker">
      <div className="max-w-5xl mx-auto p-2 md:p-4">
        <ActionBlock
          header={<Heading priority={2}>{t("rentalDirectory.callouttitle")}</Heading>}
          background="primary-darker"
          layout={ActionBlockLayout.inline}
          actions={[
            <a className="button" key="action-1" href="/get-assistance">
              {t("rentalDirectory.calloutbutton")}
            </a>,
          ]}
        />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RentDirectoryProps {
  listings: SerializableListing[]
}

export function RentDirectory({ listings }: RentDirectoryProps) {
  const { open, upcoming, results } = sortListings(listings)
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
      <div id="page-header">
        <PageHeader
          title={t("rentalDirectory.title")}
          subtitle={t("rentalDirectory.ifYouTellUs")}
        >
          <p className="mt-4 md:mt-8 mb-2">
            <LinkButton href="/eligibility-estimator">
              {t("rentalDirectory.findMatchingListings")}
            </LinkButton>
          </p>
          <a className="text-base text-primary-dark" href="/help-calculating-income">
            {t("rentalDirectory.orGetHelpCalculating")}
          </a>
        </PageHeader>
      </div>

      <DirectorySectionNav
        directoryType="forRent"
        groups={{ open, upcoming, results }}
        onNavigate={handleNavigate}
      />

      <div id="listing-results">
        {/* Open listings */}
        <ListingsGroupHeader
          title={t("listings.forRent.openListings.title")}
          subtitle={t("listings.forRent.openListings.subtitle")}
          icon={<Icon size="xlarge" symbol="house" />}
          refKey="enter-a-lottery"
        >
          {open.length > 0 ? (
            getListingCards(open)
          ) : (
            <EmptyListingsView section="openLotteries" directoryType="forRent" />
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
            <EmptyListingsView section="upcomingLotteries" directoryType="forRent" />
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
            <EmptyListingsView section="lotteryResults" directoryType="forRent" />
          )}
        </ListingsGroup>
      </div>
    </div>
  )
}
