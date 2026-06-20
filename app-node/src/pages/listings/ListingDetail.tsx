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
  PreferencesList,
  SidebarBlock,
  SiteAlert,
  t,
  type ListPreference,
} from "@uic"
import { Message } from "@bloom-housing/ui-seeds"
import { Await } from "@tanstack/react-router"
import dayjs from "dayjs"
import {
  PREFERENCES,
  PREFERENCES_IDS,
  PREFERENCES_WITH_PROOF,
} from "../../../../app/javascript/modules/constants"
import { getSfGovUrl } from "../../../../app/javascript/util/languageUtil"
import type {
  SerializableAmiChart,
  SerializableListing,
  SerializablePreference,
  SerializableUnit,
} from "../../lib/listings/server-fns"
import { getListingAddress } from "../../lib/listings/display"
import { PricingTable } from "./PricingTable"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListingDetailProps {
  listing: SerializableListing
  // Below-the-fold sections stream in after the shell (see route loader).
  pricingPromise: Promise<{ units: SerializableUnit[]; amiCharts: SerializableAmiChart[] }>
  preferencesPromise: Promise<SerializablePreference[]>
}

// Fallback while a deferred section streams in. Mirrors the spinner the Rails
// pricing table shows during its client-side fetch.
function SectionLoading() {
  return (
    <div className="flex justify-center md:my-6 md:pr-8 md:px-0 md:w-2/3 px-3 w-full">
      <Icon symbol="spinner" size="large" />
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Inlined from app/javascript/util/listingUtil (that module touches `window`
// at eval time, which crashes SSR — see preferences mapping below).
const preferenceNameHasVeteran = (preferenceName: string): boolean =>
  typeof preferenceName === "string" && preferenceName.toLowerCase().includes("veteran")

function isApplicationOpen(listing: SerializableListing): boolean {
  if (!listing.Application_Due_Date) return false
  return dayjs(listing.Application_Due_Date) > dayjs()
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
  return getListingAddress(listing)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ApplicationStatusBanner({ listing }: { listing: SerializableListing }) {
  const open = isApplicationOpen(listing)
  const dateStr = open
    ? listing.Application_Due_Date
    : listing.Application_Due_Date

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

/**
 * Resolve a preference's description. Custom (Salesforce) descriptions render
 * the listing's own text; standard preferences use the translated copy. Mirrors
 * determineDescription in app/javascript/modules/listingDetails/
 * ListingDetailsPreferences.tsx, minus the Salesforce machine-translation
 * lookup (getTranslatedString touches the DOM and isn't wired for SSR yet).
 */
function determineDescription(pref: SerializablePreference): Pick<
  ListPreference,
  "description" | "descriptionClassName"
> {
  const name = pref.preferenceName
  const nrhpDistrict = pref.NRHPDistrict as string | undefined
  if (pref.customPreferenceDescription) {
    return {
      description: (pref.description as string) ?? "",
      descriptionClassName: "translate",
    }
  }
  if (name === PREFERENCES.neighborhoodResidence && nrhpDistrict) {
    return {
      description: t(
        "listings.lotteryPreference.Neighborhood Resident Housing Preference (NRHP).desc.withDistrict",
        { number: nrhpDistrict }
      ),
    }
  }
  return { description: t(`listings.lotteryPreference.${name}.desc`) }
}

/**
 * Maps server preference records to the @uic PreferencesList card model.
 * Faithful to ListingDetailsPreferences.tsx (veteran filter, Read More +
 * Document Checklist links, "up to N units" subtitle, ordinals). The detail
 * route has no localized variant yet, so document-checklist links use the
 * non-prefixed path.
 */
function toListPreferences(preferences: SerializablePreference[]): ListPreference[] {
  return preferences
    .filter((pref) => !preferenceNameHasVeteran(pref.preferenceName))
    .map((pref, index) => {
      const name = pref.preferenceName
      const links: NonNullable<ListPreference["links"]> = []

      if (pref.readMoreUrl) {
        links.push({
          title: t("label.readMore"),
          url: getSfGovUrl(pref.readMoreUrl as string, "/"),
          ariaLabel: t(`listings.lotteryPreference.${name}.readMore`),
        })
      }

      if (PREFERENCES_WITH_PROOF.includes(name)) {
        const anchorMap: Record<string, string> = {
          "Neighborhood Resident Housing Preference (NRHP)": PREFERENCES_IDS.neighborhoodResidence,
          "Rent Burdened / Assisted Housing Preference": PREFERENCES_IDS.assistedHousing,
          "Live or Work in San Francisco Preference": PREFERENCES_IDS.liveWorkInSf,
          "Alice Griffith Housing Development Resident": PREFERENCES_IDS.rightToReturn,
          [PREFERENCES.rightToReturnHuntersView]: PREFERENCES_IDS.rightToReturn,
          [PREFERENCES.rightToReturnPotrero]: PREFERENCES_IDS.rightToReturn,
        }
        links.push({
          title: t("label.viewDocumentChecklist"),
          ariaLabel: t(`listings.lotteryPreference.${name}.additionalDocumentation`),
          url: `/document-checklist#${anchorMap[name] ?? ""}`,
        })
      }

      const unitsAvailable = pref.unitsAvailable as number | undefined
      return {
        ...determineDescription(pref),
        links,
        ordinal: index + 1,
        subtitle: unitsAvailable
          ? t("listings.lotteryPreference.upToUnits", unitsAvailable)
          : undefined,
        title: t(`listings.lotteryPreference.${name}.title`),
      }
    })
}

function PreferencesSection({ preferences }: { preferences: SerializablePreference[] }) {
  if (!preferences.length) return null
  return <PreferencesList listingPreferences={toListPreferences(preferences)} />
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

export function ListingDetail({
  listing,
  pricingPromise,
  preferencesPromise,
}: ListingDetailProps) {
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
            <h1 className="font-sans font-semibold text-2xl">{listing.Name}</h1>
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
                {listing.Lottery_Results_Date && (
                  <SidebarBlock title={t("listings.lotteryDate")} priority={2}>
                    {formatDate(listing.Lottery_Results_Date)}
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

          {/* Units / pricing — deferred (units + AMI charts stream in). Faithful
              occupancy/AMI grouping lives in PricingTable. */}
          <Await promise={pricingPromise} fallback={<SectionLoading />}>
            {({ units, amiCharts }) =>
              units.length > 0 ? (
                <ListingDetailItem
                  imageAlt=""
                  imageSrc=""
                  title={t("listings.availableUnits")}
                  subtitle=""
                >
                  <div className="listing-detail-panel">
                    <PricingTable listing={listing} units={units} amiCharts={amiCharts} />
                  </div>
                </ListingDetailItem>
              ) : null
            }
          </Await>

          {/* Eligibility / preferences — deferred (streams in). */}
          <Await promise={preferencesPromise} fallback={<SectionLoading />}>
            {(preferences) =>
              preferences.length > 0 ? (
                <ListingDetailItem
                  imageAlt=""
                  imageSrc=""
                  title={t("listings.lottery.title")}
                  subtitle={t("listingsForSale.lotteryPreferences.lotteryPreferencesArePrograms")}
                  desktopClass="bg-primary-lighter"
                >
                  <div className="listing-detail-panel">
                    <PreferencesSection preferences={preferences} />
                  </div>
                </ListingDetailItem>
              ) : null
            }
          </Await>

          {/* Additional information */}
          <ListingDetailItem
            imageAlt=""
            imageSrc=""
            title={t("listings.additionalInformation.header")}
            subtitle={t("listings.additionalInformation.subheader")}
          >
            <div className="listing-detail-panel">
              {listing.Application_Due_Date && (
                <div className="info-card bg-gray-100 border-0">
                  <p className="text-xs">
                    {`${t("t.listingUpdated")}: ${formatDate(listing.Application_Due_Date)}`}
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
