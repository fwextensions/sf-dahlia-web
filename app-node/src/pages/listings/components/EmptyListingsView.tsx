/**
 * EmptyListingsView — shown when a listings section has no listings.
 * Adapted from app/javascript/modules/listings/components/EmptyListingsView.tsx.
 */
import { Icon, t } from "@uic"
import { Heading } from "@bloom-housing/ui-seeds"
import { renderInlineMarkup } from "../../../../../app/javascript/util/languageUtil"

type DirectoryType = "forRent" | "forSale"
type SectionType = "openLotteries" | "fcfsListings" | "upcomingLotteries" | "lotteryResults"

// The descriptive section props map to the short keys used in the translation
// bundles (listingDirectory.emptyListingsView.title.{open,fcfs,upcoming,results}).
const SECTION_TITLE_KEY: Record<SectionType, string> = {
  openLotteries: "open",
  fcfsListings: "fcfs",
  upcomingLotteries: "upcoming",
  lotteryResults: "results",
}

interface EmptyListingsViewProps {
  section: SectionType
  directoryType: DirectoryType
  listingsCount?: number
}

export function EmptyListingsView({
  section,
  directoryType,
  listingsCount,
}: EmptyListingsViewProps) {
  return (
    <div className="empty-listings-view">
      <Heading size="xl" className="pb-3">
        {t(`listingDirectory.emptyListingsView.title.${SECTION_TITLE_KEY[section]}`)}
      </Heading>
      {directoryType === "forRent" && (
        <p className="page-header-text-block">
          {t("listingDirectory.emptyListingsView.forRent.subTitle.open")}
        </p>
      )}
      <div className="empty-listings-view_content">
        {listingsCount != null && listingsCount > 0 && section === "openLotteries" && (
          <div>
            <Icon className="empty-state-icon" size="medium" symbol="house" />
          </div>
        )}
        <div>
          <Icon className="empty-state-icon" size="medium" symbol="envelope" />
          {renderInlineMarkup(
            t("listingDirectory.emptyListingsView.getAnEmail", {
              target: "https://confirmsubscription.com/h/y/C3BAFCD742D47910",
            })
          )}
        </div>
      </div>
    </div>
  )
}
