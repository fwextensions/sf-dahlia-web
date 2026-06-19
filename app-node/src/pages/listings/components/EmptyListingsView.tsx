/**
 * EmptyListingsView — shown when a listings section has no listings.
 * Adapted from app/javascript/modules/listings/components/EmptyListingsView.tsx.
 */
import { Icon, t } from "@uic"
import { Heading } from "@bloom-housing/ui-seeds"

type DirectoryType = "forRent" | "forSale"
type SectionType = "openLotteries" | "fcfsListings" | "upcomingLotteries" | "lotteryResults"

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
        {t(`listingDirectory.emptyListingsView.title.${section}`)}
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
          <a
            href="https://confirmsubscription.com/h/y/C3BAFCD742D47910"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("listingDirectory.emptyListingsView.getAnEmail")}
          </a>
        </div>
      </div>
    </div>
  )
}
