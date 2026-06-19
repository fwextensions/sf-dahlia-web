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
  ListingCard,
  PageHeader,
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
    if (listing.applicationDueDate && dayjs(listing.applicationDueDate) > dayjs()) {
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

  return { open, upcoming, results, additional }
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

  return (
    <div>
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
