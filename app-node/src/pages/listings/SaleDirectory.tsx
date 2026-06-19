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
  ListingCard,
  t,
} from "@uic"
import dayjs from "dayjs"
import type { SerializableListing } from "../../lib/listings/server-fns"
import { ListingsGroupHeader } from "./components/ListingsGroupHeader"
import { ListingsGroup } from "./components/ListingsGroup"
import { EmptyListingsView } from "./components/EmptyListingsView"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListingsGroups {
  open: SerializableListing[]
  fcfs: SerializableListing[]
  upcoming: SerializableListing[]
  results: SerializableListing[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isFcfsSalesListing(listing: SerializableListing): boolean {
  return listing.listingType === "ownership" && listing.status === "Active" &&
    !!(listing as Record<string, unknown>)["Application_Start_Date_Time"]
}

function sortListings(listings: SerializableListing[]): ListingsGroups {
  const open: SerializableListing[] = []
  const fcfs: SerializableListing[] = []
  const upcoming: SerializableListing[] = []
  const results: SerializableListing[] = []

  listings.forEach((listing) => {
    if (isFcfsSalesListing(listing)) {
      fcfs.push(listing)
    } else if (listing.applicationDueDate && dayjs(listing.applicationDueDate) > dayjs()) {
      open.push(listing)
    } else if (listing.lotteryStatus === "Lottery Complete") {
      results.push(listing)
    } else {
      upcoming.push(listing)
    }
  })

  open.sort((a, b) => {
    if (!a.applicationDueDate) return 1
    if (!b.applicationDueDate) return -1
    return new Date(a.applicationDueDate) > new Date(b.applicationDueDate) ? 1 : -1
  })
  upcoming.sort((a, b) => {
    if (!a.applicationDueDate) return 1
    if (!b.applicationDueDate) return -1
    return new Date(a.applicationDueDate) < new Date(b.applicationDueDate) ? 1 : -1
  })
  results.sort((a, b) => {
    if (!a.lotteryDate) return 1
    if (!b.lotteryDate) return -1
    return new Date(a.lotteryDate) < new Date(b.lotteryDate) ? 1 : -1
  })

  return { open, fcfs, upcoming, results }
}

function getListingCards(listings: SerializableListing[]): JSX.Element[] {
  return listings.map((listing) => {
    const imageUrl = typeof listing.imageURL === "string" ? listing.imageURL : undefined
    const dueDate = listing.applicationDueDate
    const isOpen = dueDate ? dayjs(dueDate) > dayjs() : false
    const statusContent = dueDate
      ? `${isOpen ? t("listingDirectory.listingStatusContent.applicationDeadline") : t("listingDirectory.listingStatusContent.applicationsClosed")}: ${dayjs(dueDate).format("MMMM D, YYYY")}`
      : ""
    const reservedText = typeof listing.reservedDescriptor === "string"
      ? listing.reservedDescriptor
      : undefined

    return (
      <ListingCard
        key={listing.listingID}
        stackedTable={false}
        imageCardProps={{
          imageUrl,
          href: `/listings/${listing.listingID}`,
          statuses: dueDate
            ? [{ status: isOpen ? 0 : 2, content: statusContent }]
            : [],
          tags: reservedText ? [{ text: reservedText }] : [],
          description: listing.name,
        }}
        contentProps={{
          contentHeader: {
            content: listing.name,
            href: `/listings/${listing.listingID}`,
          },
          contentSubheader: {
            content: `${listing.buildingAddress}, ${listing.buildingCity}, ${listing.buildingState} ${listing.buildingZip}`,
          },
        }}
        footerButtons={[
          { text: t("t.seeDetails"), href: `/listings/${listing.listingID}` },
        ]}
      />
    )
  })
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

// ─── Main component ───────────────────────────────────────────────────────────

interface SaleDirectoryProps {
  listings: SerializableListing[]
}

export function SaleDirectory({ listings }: SaleDirectoryProps) {
  const { open, fcfs, upcoming, results } = sortListings(listings)

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="buy-header_columns max-w-5xl mx-auto px-6 py-8">
          <Heading className="buy-header_title buy-header_left_col">
            {t("saleDirectory.title")}
          </Heading>
          <div className="mb-8 buy-header_right_col">
            <a href="#nav-bar-container" className="button is-primary is-fullwidth">
              {t("saleDirectory.seeHomesForSale")}
            </a>
          </div>
        </div>
      </div>

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
