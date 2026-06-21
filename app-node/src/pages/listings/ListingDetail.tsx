/**
 * ListingDetail page component.
 *
 * Renders a single listing's full detail view using Bloom UI components.
 * Data is pre-loaded server-side via the route loader — no client-side API calls.
 *
 * Mirrors the structure of app/javascript/pages/listings/listing-detail.tsx
 * but uses SerializableListing / SerializableUnit / SerializablePreference types
 * from the app-node server functions. The raw Salesforce fields not declared on
 * SerializableListing (Listing_Images[], Open_Houses[], Leasing_Agent_*, …) are
 * present at runtime — the server fns pass the proxy response through unchanged —
 * and are reached through the RawListing cast below.
 */
import {
  Card,
  Contact,
  EventSection,
  ExpandableSection,
  Heading,
  Icon,
  ImageCard,
  type ImageItem,
  InfoCard,
  LinkButton,
  ListSection,
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
  CUSTOM_LISTING_TYPES,
  PREFERENCES,
  PREFERENCES_IDS,
  PREFERENCES_WITH_PROOF,
  TENURE_TYPES,
} from "../../../../app/javascript/modules/constants"
import {
  getCustomListingType,
  getReservedCommunityType,
  getSfGovUrl,
  localizedFormat,
  renderInlineMarkup,
  renderMarkup,
} from "../../../../app/javascript/util/languageUtil"
import { ListingDetailsChisholmPreferences } from "../../../../app/javascript/modules/listingDetails/ListingDetailsChisholmPreferences"
import type {
  SerializableAmiChart,
  SerializableListing,
  SerializablePreference,
  SerializableUnit,
} from "../../lib/listings/server-fns"
import { getListingAddress } from "../../lib/listings/display"
import { PricingTable } from "./PricingTable"
import {
  AdditionalEligibilityRules,
  AdditionalInfoSection,
  FeaturesSection,
  HouseholdMaxIncomeTable,
  MailingListSignup,
  NeighborhoodSection,
  OccupancyTable,
  RentalAssistance,
} from "./ListingDetailSections"
import fallbackImg from "../../../../app/assets/images/bg@1200.jpg"
import shareButton from "../../../../app/assets/images/share-button.svg"
// Card chrome + checkmark bullets for the educator eligibility card.
import "../../../../app/javascript/modules/listingDetails/ListingDetailsEligibility.css"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListingDetailProps {
  listing: SerializableListing
  // Below-the-fold sections stream in after the shell (see route loader).
  pricingPromise: Promise<{ units: SerializableUnit[]; amiCharts: SerializableAmiChart[] }>
  preferencesPromise: Promise<SerializablePreference[]>
}

interface ListingEvent {
  Id?: string
  Date?: string
  Start_Time?: string
  End_Time?: string
  Venue?: string
  City?: string
  Street_Address?: string
}

interface ListingImage {
  displayImageURL?: string
  Image_Description?: string
  Id?: string
}

/**
 * Raw Salesforce fields not narrowed onto SerializableListing but present at
 * runtime. Cast (not extend) because SerializableListing's index signature is
 * primitive-only and would reject array/object members.
 */
interface RawListing {
  Developer?: string | null
  Listing_Images?: ListingImage[]
  Reserved_community_type?: string | null
  Reserved_community_type_Description?: string | null
  Open_Houses?: ListingEvent[]
  Leasing_Agent_Name?: string | null
  Leasing_Agent_Email?: string | null
  Leasing_Agent_Phone?: string | null
  Leasing_Agent_Title?: string | null
  Leasing_Agent_Street?: string | null
  Leasing_Agent_City?: string | null
  Leasing_Agent_State?: string | null
  Leasing_Agent_Zip?: string | null
  Office_Hours?: string | null
  Lottery_Date?: string | null
  Lottery_Venue?: string | null
  Lottery_City?: string | null
  Lottery_Street_Address?: string | null
  LotteryResultsURL?: string | null
  LastModifiedDate?: string | null
}

const raw = (listing: SerializableListing): RawListing => listing as unknown as RawListing

// Fallback while a deferred section streams in. Mirrors the spinner the Rails
// pricing table shows during its client-side fetch.
function SectionLoading() {
  return (
    <div className="flex justify-center md:my-6 md:pr-8 md:px-0 md:w-2/3 px-3 w-full">
      <Icon symbol="spinner" size="large" />
    </div>
  )
}

// ─── SSR-safe predicates ─────────────────────────────────────────────────────
// Inlined from app/javascript/util/listingUtil (that module's transitive imports
// touch `window`, which crashes SSR). Kept faithful to the originals.

function isApplicationOpen(listing: SerializableListing): boolean {
  if (!listing.Application_Due_Date) return false
  return dayjs(listing.Application_Due_Date) > dayjs()
}

const isRental = (listing: SerializableListing): boolean =>
  listing.Tenure === TENURE_TYPES.NEW_RENTAL || listing.Tenure === TENURE_TYPES.RE_RENTAL

const isEducator = (listing: SerializableListing): boolean =>
  listing.Custom_Listing_Type === CUSTOM_LISTING_TYPES.EDUCATOR_ONE ||
  listing.Custom_Listing_Type === CUSTOM_LISTING_TYPES.EDUCATOR_TWO ||
  listing.Custom_Listing_Type === CUSTOM_LISTING_TYPES.EDUCATOR_THREE

const isEducatorOne = (listing: SerializableListing): boolean =>
  listing.Custom_Listing_Type === CUSTOM_LISTING_TYPES.EDUCATOR_ONE

const preferenceNameHasVeteran = (preferenceName: string): boolean =>
  typeof preferenceName === "string" && preferenceName.toLowerCase().includes("veteran")

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined, format = "MMMM D, YYYY"): string | null {
  if (!dateStr) return null
  return dayjs(dateStr).format(format)
}

function getFullAddress(listing: SerializableListing): string {
  return getListingAddress(listing)
}

// Tag content (custom listing type takes precedence over reserved community).
// Mirrors getTagContent in app/javascript/util/listingUtil.
function getTagContent(listing: SerializableListing): { text: string }[] | undefined {
  if (listing.Custom_Listing_Type) {
    const text = getCustomListingType(listing.Custom_Listing_Type)
    if (text) return [{ text }]
  }
  const reserved = raw(listing).Reserved_community_type
  return reserved ? [{ text: getReservedCommunityType(reserved) }] : undefined
}

function getEventTimeString(event: ListingEvent): string {
  if (event.Start_Time) {
    return event.End_Time ? `${event.Start_Time} - ${event.End_Time}` : event.Start_Time
  }
  return ""
}

function getEventNote(event: ListingEvent): React.ReactNode {
  if (!event.Venue) return null
  return (
    <div className="flex flex-col">
      <span className="links-space translate">{renderInlineMarkup(event.Venue)}</span>
      {event.Street_Address && event.City && (
        <span>{`${event.Street_Address}, ${event.City}`}</span>
      )}
    </div>
  )
}

// ─── Image / header card ──────────────────────────────────────────────────────

function HeaderCard({ listing }: { listing: SerializableListing }) {
  const address = getFullAddress(listing)
  const images: ImageItem[] | undefined = raw(listing).Listing_Images?.map((img) => ({
    url: img.displayImageURL ?? "",
    description: img.Image_Description ?? "",
  })).filter((img) => img.url)

  const imageCardProps =
    images && images.length > 0
      ? {
          images,
          description: t("listings.buildingImageAltText"),
          moreImagesLabel: t("listings.morePhotos"),
        }
      : { imageUrl: fallbackImg, description: "" }

  return (
    <header className="image-card--leader">
      <ImageCard
        innerClassName="translate"
        {...imageCardProps}
        tags={getTagContent(listing)}
        modalAriaTitle="true"
      />
      <div className="flex flex-col md:items-start md:text-left p-3 text-center">
        <h1 className="font-sans font-semibold text-2xl">{listing.Name}</h1>
        <p className="my-1 text-gray-700">{address}</p>
        <div className="flex flex-col items-center md:flex-row md:justify-between md:w-full">
          <div>
            {raw(listing).Developer && <p className="text-gray-700">{raw(listing).Developer}</p>}
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
          <a
            href={`/listings/${listing.listingID}/share`}
            aria-label={t("pageTitle.shareThisListing")}
            target="_blank"
            rel="noopener noreferrer"
            className="share-button"
          >
            <img alt={t("label.shareListView")} src={shareButton} />
          </a>
        </div>
      </div>
    </header>
  )
}

// ─── Aside (desktop sidebar) ──────────────────────────────────────────────────

function LotteryInfo({ listing }: { listing: SerializableListing }) {
  const r = raw(listing)
  // Only shown once applications have closed and a lottery date exists.
  if (isApplicationOpen(listing) || !r.Lottery_Date) return null
  return (
    <div className="border-b border-gray-400 md:border-b-0">
      <SidebarBlock title={t("label.lottery")} priority={2}>
        <p className="flex justify-between mb-4">
          <span>{localizedFormat(r.Lottery_Date, "LL")}</span>
          <span className="font-bold">{localizedFormat(r.Lottery_Date, "h:mm a")}</span>
        </p>
        {r.Lottery_Venue && (
          <div className="text-gray-700">{renderMarkup(r.Lottery_Venue)}</div>
        )}
        <p className="mt-4 text-gray-700">{t("label.preLotteryInfo")}</p>
      </SidebarBlock>
    </div>
  )
}

function OpenHouses({ listing }: { listing: SerializableListing }) {
  const openHouses = raw(listing).Open_Houses
  if (!openHouses?.length) return null
  const events = openHouses
    .map((oh) => ({
      dateString: oh.Date ? localizedFormat(oh.Date, "LL") : "",
      timeString: getEventTimeString(oh),
      note: getEventNote(oh),
      sortKey: `${oh.Date ?? ""} ${oh.Start_Time ?? ""}`,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return (
    <div className="open-houses border-b border-gray-400 md:border-b-0">
      <section className="aside-block">
        <Heading priority={2} styleType="underlineWeighted">
          {t("label.openHouses")}
        </Heading>
        {events.map((event, index) => (
          <div key={`oh-${index}`} className={index !== events.length - 1 ? "pb-3" : ""}>
            {event.dateString && (
              <p className="text text-gray-800 pb-2 flex justify-between items-center">
                <span className="inline-block text-sm uppercase normal-case">
                  {event.dateString}
                </span>
                {event.timeString && (
                  <span className="inline-block text-xs font-bold ml-5 font-alt-sans">
                    {event.timeString}
                  </span>
                )}
              </p>
            )}
            {event.note && <div className="text-sm text-gray-700">{event.note}</div>}
          </div>
        ))}
      </section>
    </div>
  )
}

function ApplySidebar({ listing }: { listing: SerializableListing }) {
  if (!isApplicationOpen(listing)) return null
  return (
    <SidebarBlock title={t("listings.apply.howToApply")} priority={2}>
      <LinkButton className="w-full" href={`/listings/${listing.listingID}/apply/intro`}>
        {t("label.applyOnline")}
      </LinkButton>
    </SidebarBlock>
  )
}

function NeedHelp() {
  return (
    <div className="md:px-0 px-2">
      <SidebarBlock title={t("listings.apply.needHelp")} priority={2}>
        <div className="mb-4">{t("listings.apply.visitAHousingCounselor")}</div>
        <LinkButton transition newTab href="/housing-counselors" className="w-full">
          {t("housingCounselor.findAHousingCounselor")}
        </LinkButton>
      </SidebarBlock>
    </div>
  )
}

function WhatToExpect() {
  return (
    <div>
      <ExpandableSection
        content={t("emailer.submissionConfirmation.applicantsWillBeContacted")}
        expandableContent={
          <>
            <p>{t("f2ReviewTerms.p3")}</p>
            <p className="mt-2 mb-2">{t("label.whatToExpectApplicationChosen")}</p>
          </>
        }
        strings={{
          title: t("label.whatToExpect"),
          readMore: t("label.showMore"),
          readLess: t("label.showLess"),
          buttonAriaLabel: t("listings.whatToExpect.showMore.aria"),
        }}
        priority={2}
      />
    </div>
  )
}

function PublicLotteryEvent({ listing }: { listing: SerializableListing }) {
  const r = raw(listing)
  if (
    !r.Lottery_Date ||
    !(dayjs(r.Lottery_Date) > dayjs()) ||
    r.LotteryResultsURL ||
    !isApplicationOpen(listing)
  ) {
    return null
  }
  return (
    <div className="border-b border-gray-400 md:border-b-0">
      <EventSection
        events={[
          {
            dateString: localizedFormat(r.Lottery_Date, "LL"),
            timeString: dayjs(r.Lottery_Date).format("hh:mma"),
            note: getEventNote({
              City: r.Lottery_City ?? undefined,
              Street_Address: r.Lottery_Street_Address ?? undefined,
              Venue: r.Lottery_Venue ?? undefined,
            }),
          },
        ]}
        headerText={t("listings.process.publicLottery")}
        priority={2}
        sectionHeader
      />
    </div>
  )
}

function ContactAgent({ listing }: { listing: SerializableListing }) {
  const r = raw(listing)
  if (!isRental(listing)) return null
  const hasContact =
    r.Leasing_Agent_Email ||
    r.Leasing_Agent_Name ||
    r.Leasing_Agent_Phone ||
    r.Office_Hours ||
    r.Leasing_Agent_Title
  if (!hasContact) return null

  return (
    <div className="border-b border-gray-400 md:border-b-0 last:border-b-0">
      <Contact
        sectionTitle={t("contactAgent.contact")}
        priority={2}
        contactAddress={{
          street: r.Leasing_Agent_Street ?? undefined,
          city: r.Leasing_Agent_City ?? undefined,
          state: r.Leasing_Agent_State ?? undefined,
          zipCode: r.Leasing_Agent_Zip ?? undefined,
        }}
        additionalInformation={
          r.Office_Hours
            ? [
                {
                  title: t("contactAgent.officeHours"),
                  content: (
                    <span className="translate">{renderInlineMarkup(r.Office_Hours)}</span>
                  ),
                },
              ]
            : undefined
        }
        contactEmail={r.Leasing_Agent_Email ?? undefined}
        contactName={r.Leasing_Agent_Name ?? undefined}
        contactPhoneNumber={
          r.Leasing_Agent_Phone
            ? t("listings.call", { phoneNumber: r.Leasing_Agent_Phone })
            : undefined
        }
        contactPhoneNumberNote={t("contactAgent.dueToHighCallVolume")}
        contactTitle={r.Leasing_Agent_Title ?? undefined}
        contactTitleClassname="translate"
        strings={{
          email: t("label.emailAddress"),
          getDirections: t("label.getDirections"),
        }}
      />
    </div>
  )
}

function Aside({ listing }: { listing: SerializableListing }) {
  const open = isApplicationOpen(listing)
  const rental = isRental(listing)
  return (
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
          <LotteryInfo listing={listing} />
          {rental && <OpenHouses listing={listing} />}
          <ApplySidebar listing={listing} />
          {open && rental && <NeedHelp />}
          <PublicLotteryEvent listing={listing} />
          <WhatToExpect />
          <ContactAgent listing={listing} />
        </div>
      </aside>
    </ListingDetailItem>
  )
}

// ─── Application status banner ────────────────────────────────────────────────

function ApplicationStatusBanner({ listing }: { listing: SerializableListing }) {
  const open = isApplicationOpen(listing)
  const dateStr = listing.Application_Due_Date
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

// ─── Eligibility / preferences ────────────────────────────────────────────────

/**
 * Resolve a preference's description. Custom (Salesforce) descriptions render
 * the listing's own text; standard preferences use the translated copy.
 */
function determineDescription(pref: SerializablePreference): Pick<
  ListPreference,
  "description" | "descriptionClassName"
> {
  const name = pref.preferenceName
  const nrhpDistrict = pref.NRHPDistrict as string | undefined
  if (pref.customPreferenceDescription) {
    return { description: (pref.description as string) ?? "", descriptionClassName: "translate" }
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

/**
 * SFUSD educator eligibility copy (Educator 2/3 variant). Faithful to the
 * educator branch of app/javascript/modules/listingDetails/ListingDetailsEligibility.
 */
function EducatorEligibilityCopy() {
  return (
    <ListSection title={t("listings.customListingType.educator.eligibility.title")} subtitle="">
      <Card className="educator-eligibility">
        <Card.Section className="markdown">
          <div>
            <p>
              <b>{t("listings.customListingType.educator.eligibility.priority")}</b>
            </p>
            <p>{t("listings.customListingType.educator.eligibility.priority1")}</p>
            <p className="mb-0">{t("listings.customListingType.educator.eligibility.priority2")}</p>
            <ul className="ml-0 my-1">
              <li>
                {renderInlineMarkup(
                  t("listings.customListingType.educator.eligibility.sfusd", {
                    sfusdLink: "https://www.sfusd.edu/",
                  }),
                  "<a><b>"
                )}
              </li>
              <li>{t("listings.customListingType.educator.eligibility.code")}</li>
            </ul>
            <p>
              {renderInlineMarkup(
                t("listings.customListingType.educator.eligibility.part2", {
                  chisholmLink: getSfGovUrl("https://sf.gov/apply-shirley-chisholm-village-housing"),
                })
              )}
            </p>
            <p>{t("listings.customListingType.educator.eligibility.priority3")}</p>
            <p>
              {renderInlineMarkup(
                t("listings.customListingType.educator.eligibility.priority4", {
                  learnMoreLink: "#chisholm-preferences",
                })
              )}
            </p>
          </div>
        </Card.Section>
      </Card>
    </ListSection>
  )
}

function PriorityUnits({ units }: { units: SerializableUnit[] }) {
  const counts = new Map<string, number>()
  units.forEach((unit) => {
    const type = unit.Priority_Type as string | undefined
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1)
  })
  const priorityUnits = [...counts.entries()].filter(([name]) => name !== "Adaptable")
  if (priorityUnits.length === 0) return null

  return (
    <ListSection
      title={t("listings.priorityUnits")}
      subtitle={t("listings.priorityUnitsDescription")}
    >
      {priorityUnits.map(([name, count]) => (
        <InfoCard
          key={name}
          title={t(`listings.${name}.title`)}
          subtitle={count === 1 ? `${count} ${t("listings.features.unit")}` : `${count} ${t("t.units")}`}
        >
          <p className="text-sm text-gray-700">
            {t(`listings.unitsHaveAccessibilityFeaturesFor.${name}`)}
          </p>
        </InfoCard>
      ))}
    </ListSection>
  )
}

function EligibilitySection({
  listing,
  preferences,
  units,
  amiCharts,
}: {
  listing: SerializableListing
  preferences: SerializablePreference[]
  units: SerializableUnit[]
  amiCharts: SerializableAmiChart[]
}) {
  const educator = isEducator(listing)
  return (
    <ListingDetailItem
      imageAlt=""
      imageSrc=""
      title={t("listings.eligibility.header")}
      subtitle={t("listings.eligibility.subheader")}
      desktopClass="bg-primary-lighter"
    >
      <ul>
        {educator && <EducatorEligibilityCopy />}
        <HouseholdMaxIncomeTable listing={listing} units={units} amiCharts={amiCharts} />
        <OccupancyTable listing={listing} />
        {educator ? (
          <span id="chisholm-preferences">
            <ListingDetailsChisholmPreferences isEducatorOne={isEducatorOne(listing)} />
          </span>
        ) : (
          preferences.length > 0 && (
            <ListSection
              title={t("listings.lottery.title")}
              subtitle={t("listingsForSale.lotteryPreferences.lotteryPreferencesArePrograms")}
            >
              <PreferencesList listingPreferences={toListPreferences(preferences)} />
            </ListSection>
          )
        )}
        <PriorityUnits units={units} />
        <RentalAssistance listing={listing} />
        <AdditionalEligibilityRules listing={listing} />
      </ul>
    </ListingDetailItem>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ListingDetail({
  listing,
  pricingPromise,
  preferencesPromise,
}: ListingDetailProps) {
  const alertClasses = "flex-grow mt-6 max-w-6xl w-full"

  return (
    <div className="overflow-x-hidden">
      {/* Site-wide alerts */}
      <div className="flex absolute w-full flex-col items-center border-0 border-t border-solid">
        <SiteAlert type="alert" className={alertClasses} />
        <SiteAlert type="success" className={alertClasses} timeout={30_000} />
      </div>

      <article className="flex flex-wrap flex-col relative max-w-5xl m-auto w-full">
        <HeaderCard listing={listing} />

        {/* Mobile: application status */}
        <div className="md:hidden px-4 py-2">
          <ApplicationStatusBanner listing={listing} />
          {isApplicationOpen(listing) && (
            <div className="mt-4">
              <ApplySidebar listing={listing} />
            </div>
          )}
        </div>

        {/* Units / pricing — deferred. Rendered as a direct article child (not in a
            ListingDetailItem) so its own md:w-2/3 spans 2/3 of the article, matching
            Rails. Nesting it in a ListingDetailItem would constrain it twice. */}
        <Await promise={pricingPromise} fallback={<SectionLoading />}>
          {({ units, amiCharts }) =>
            units.length > 0 ? (
              <PricingTable listing={listing} units={units} amiCharts={amiCharts} />
            ) : null
          }
        </Await>

        <ListingDetails>
          <Aside listing={listing} />

          {/* Eligibility / preferences — deferred (needs preferences + pricing). */}
          <Await promise={preferencesPromise} fallback={<SectionLoading />}>
            {(preferences) => (
              <Await promise={pricingPromise} fallback={<SectionLoading />}>
                {({ units, amiCharts }) => (
                  <EligibilitySection
                    listing={listing}
                    preferences={preferences}
                    units={units}
                    amiCharts={amiCharts}
                  />
                )}
              </Await>
            )}
          </Await>

          {/* Features — deferred (needs units for the unit accordions). */}
          <Await promise={pricingPromise} fallback={<SectionLoading />}>
            {({ units }) => <FeaturesSection listing={listing} units={units} />}
          </Await>

          {/* Neighborhood (map) */}
          <NeighborhoodSection listing={listing} />

          {/* Additional information */}
          <AdditionalInfoSection listing={listing} />
        </ListingDetails>

        <MailingListSignup />
      </article>
    </div>
  )
}
