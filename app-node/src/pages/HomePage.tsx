/**
 * Native home page (SSR). Ports app/javascript/pages/index.tsx without Layout /
 * withAppSetup — the native route supplies the AppShell chrome and the root
 * route supplies translations. Directory links are localized so navigating from
 * a localized home keeps the language.
 */
import { t, SiteAlert, Hero, ActionBlock, Heading } from "@uic"
import { getLocalizedPath } from "../lib/i18n/localized-path"
import heroBg from "../../../app/assets/images/bg@1200.jpg"

// Mailing-list signup URL (ConfigContext.listingsAlertUrl in the Rails app).
const LISTINGS_ALERT_URL = "https://confirmsubscription.com/h/y/C3BAFCD742D47910"

export function HomePage() {
  const alertClasses = "grow mt-6 max-w-6xl w-full"

  return (
    <>
      <div className="flex absolute w-full flex-col items-center">
        <SiteAlert type="alert" className={alertClasses} />
        <SiteAlert type="success" className={alertClasses} timeout={30_000} />
      </div>
      <Hero
        title={t("welcome.title")}
        backgroundImage={heroBg}
        buttonLink={getLocalizedPath("/listings/for-rent")}
        buttonTitle={t("welcome.seeRentalListings")}
        secondaryButtonLink={getLocalizedPath("/listings/for-sale")}
        secondaryButtonTitle={t("welcome.seeSaleListings")}
      />
      <div className="homepage-extra mt-2">
        <ActionBlock
          header={<Heading priority={2}>{t("welcome.newListingEmailAlert")}</Heading>}
          actions={[
            <a
              className="button"
              key="action-1"
              href={LISTINGS_ALERT_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("welcome.signUpToday")}
            </a>,
          ]}
        />
      </div>
    </>
  )
}
