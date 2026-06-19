/**
 * ListingDetail page component.
 *
 * Renders a single listing's full detail view using Bloom UI components.
 * Data is pre-loaded server-side via the route loader — no client-side API calls.
 *
 * Mirrors the structure of app/javascript/pages/listings/listing-detail.tsx
 * but uses SerializableListing / SerializableUnit / SerializablePreference types
 * from the app-node server functions.
 */
import {
  Icon,
  LinkButton,
  ListingDetailItem,
  ListingDetails,
  SidebarBlock,
  SiteAlert,
  StandardTable,
  t,
} from "@uic"
import { Message } from "@bloom-housing/ui-seeds"
import dayjs from "dayjs"
import type {
  SerializableListing,
  SerializablePreference,
  SerializableUnit,
} from "../../lib/listings/server-fns"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListingDetailProps {
  listing: SerializableListing
  units: SerializableUnit[]
  preferences: SerializablePreference[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isApplicationOpen(listing: SerializableListing): boolean {
  if (!listing.applicationDueDate) return false
  return dayjs(listing.applicationDueDate) > dayjs()
}

function formatDate(dateStr: string | null, format = "MMMM D, YYYY"): string | null {
  if (!dateStr) return null
  return dayjs(dateStr).format(format)
}

function formatDateTime(dateStr: string | null): string | null {
  if (!dateStr) return null
  return dayjs(dateStr).format("MMMM D, YYYY [at] h:mm A")
}

function getFullAddress(listing: SerializableListing): string {
  return [
    listing.buildingAddress,
    listing.buildingCity,
    listing.buildingState,
    listing.buildingZip,
  ]
    .filter(Boolean)
    .join(", ")
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ApplicationStatusBanner({ listing }: { listing: SerializableListing }) {
  const open = isApplicationOpen(listing)
  const dateStr = open
    ? listing.applicationDueDate
    : listing.applicationDueDate

  const message = open
    ? t("listingDetails.applicationsDeadline.withDateTime", {
        date: formatDate(dateStr),
        time: dayjs(dateStr).format("h:mm A"),
      })
    : t("listingDetails.applicationsClosed.withDateTime", {
        date: formatDate(dateStr),
        time: dayjs(dateStr).format("h:mm A"),
      })

  return (
    <Message
      fullwidth
      className="justify-start leading-5"
      variant={open ? "primary" : "alert"}
      customIcon={<Icon fill={open ? "" : "red-700"} symbol="clock" size="medium" />}
    >
      {message}
    </Message>
  )
}

function UnitsTable({ units }: { units: SerializableUnit[] }) {
  if (!units.length) return null

  const headers = {
    unitType: "t.unitType",
    bedrooms: "t.bedrooms",
    bathrooms: "t.bathrooms",
    sqFt: "t.sqFt",
    rent: "t.rent",
  }

  const data = units.map((unit, i) => ({
    unitType: {
      content: unit.unitType
        ? t(`listings.unitTypes.${unit.unitType}`, { defaultValue: unit.unitType })
        : "—",
    },
    bedrooms: { content: unit.numBedrooms != null ? String(unit.numBedrooms) : "—" },
    bathrooms: { content: unit.numBathrooms != null ? String(unit.numBathrooms) : "—" },
    sqFt: { content: unit.sqFt != null ? unit.sqFt.toLocaleString() : "—" },
    rent: {
      content:
        unit.bmrRentMonthly != null
          ? `$${Math.round(unit.bmrRentMonthly).toLocaleString()}/mo`
          : "—",
    },
  }))

  return (
    <div className="listing-detail-panel">
      <StandardTable headers={headers} data={data} />
    </div>
  )
}

function PreferencesList({ preferences }: { preferences: SerializablePreference[] }) {
  if (!preferences.length) return null

  const sorted = [...preferences].sort((a, b) => a.preferenceOrder - b.preferenceOrder)

  return (
    <ol className="list-decimal ml-6 space-y-1">
      {sorted.map((pref) => (
        <li key={pref.listingPreferenceID} className="text-sm">
          {pref.preferenceName}
        </li>
      ))}
    </ol>
  )
}

function ApplySidebar({ listing }: { listing: SerializableListing }) {
  const open = isApplicationOpen(listing)
  if (!open) return null

  return (
    <SidebarBlock title={t("listings.apply.howToApply")} priority={2}>
      <LinkButton
        className="w-full"
        href={`/listings/${listing.listingID}/apply/intro`}
      >
        {t("label.applyOnline")}
      </LinkButton>
    </SidebarBlock>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ListingDetail({ listing, units, preferences }: ListingDetailProps) {
  const address = getFullAddress(listing)
  const open = isApplicationOpen(listing)
  const alertClasses = "flex-grow mt-6 max-w-6xl w-full"

  return (
    <div className="overflow-x-hidden">
      {/* Site-wide alerts */}
      <div className="flex absolute w-full flex-col items-center border-0 border-t border-solid">
        <SiteAlert type="alert" className={alertClasses} />
        <SiteAlert type="success" className={alertClasses} timeout={30_000} />
      </div>

      <article className="flex flex-wrap flex-col relative max-w-5xl m-auto w-full">
        {/* Image / header card */}
        <header className="image-card--leader">
          <div className="flex flex-col md:items-start md:text-left p-3 text-center">
            <h1 className="font-sans font-semibold text-2xl">{listing.name}</h1>
            <p className="my-1 text-gray-700">{address}</p>
            <p className="my-2">
              <a
                href={`https://www.google.com/maps/place/${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("label.opensInNewWindow", { linkText: t("label.viewOnMap") })}
              >
                {t("label.viewOnMap")}
              </a>
            </p>
          </div>
        </header>

        {/* Application status + sidebar */}
        <ListingDetails>
          {/* Sidebar (desktop) */}
          <ListingDetailItem
            imageAlt=""
            imageSrc=""
            title={t("listings.process.header")}
            subtitle={t("listings.process.subheader")}
            hideHeader={true}
            desktopClass="header-hidden"
          >
            <aside className="w-full static md:absolute md:right-0 md:w-1/3 md:top-0 sm:w-2/3 md:ml-2 h-full md:border border-solid bg-white">
              <div className="hidden md:block">
                <div className="w-full mb-8 md:mb-0">
                  <ApplicationStatusBanner listing={listing} />
                </div>
                <ApplySidebar listing={listing} />
                {listing.lotteryDate && (
                  <SidebarBlock title={t("listings.lotteryDate")} priority={2}>
                    {formatDate(listing.lotteryDate)}
                  </SidebarBlock>
                )}
              </div>
            </aside>
          </ListingDetailItem>

          {/* Mobile: application status */}
          <div className="md:hidden px-4 py-2">
            <ApplicationStatusBanner listing={listing} />
            {open && (
              <div className="mt-4">
                <ApplySidebar listing={listing} />
              </div>
            )}
          </div>

          {/* Units / pricing */}
          {units.length > 0 && (
            <ListingDetailItem
              imageAlt=""
              imageSrc=""
              title={t("listings.availableUnits")}
              subtitle=""
            >
              <UnitsTable units={units} />
            </ListingDetailItem>
          )}

          {/* Eligibility / preferences */}
          {preferences.length > 0 && (
            <ListingDetailItem
              imageAlt=""
              imageSrc=""
              title={t("listings.lottery.title")}
              subtitle={t("listingsForSale.lotteryPreferences.lotteryPreferencesArePrograms")}
              desktopClass="bg-primary-lighter"
            >
              <div className="listing-detail-panel">
                <PreferencesList preferences={preferences} />
              </div>
            </ListingDetailItem>
          )}

          {/* Additional information */}
          <ListingDetailItem
            imageAlt=""
            imageSrc=""
            title={t("listings.additionalInformation.header")}
            subtitle={t("listings.additionalInformation.subheader")}
          >
            <div className="listing-detail-panel">
              {listing.applicationDueDate && (
                <div className="info-card bg-gray-100 border-0">
                  <p className="text-xs">
                    {`${t("t.listingUpdated")}: ${formatDate(listing.applicationDueDate)}`}
                  </p>
                </div>
              )}
            </div>
          </ListingDetailItem>
        </ListingDetails>
      </article>
    </div>
  )
}
