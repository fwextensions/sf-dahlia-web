/**
 * AppShell — SSR-safe site chrome (header + footer) for NATIVE app-node routes.
 *
 * Bridged routes (RailsPage) self-wrap in app/javascript/layouts/Layout.tsx, so
 * they already have chrome. Native SSR routes render only their content, so the
 * root renders this shell around them (see __root.tsx; gated on a route's
 * `staticData.nativeShell`).
 *
 * Why a separate component instead of reusing Layout.tsx: Layout touches
 * `window` at render (documentMode check, window.location in getLanguageItems /
 * feedback banner / footer links, isTokenValid from localStorage) and pulls
 * ConfigContext/UserContext. That crashes SSR. This shell takes `pathname` as a
 * prop, uses the window-guarded Bloom `@uic` SiteHeader/SiteFooter directly, and
 * routes asset lookups through the build-time assetPaths map. window-only work
 * (language switch navigation) is deferred into onClick handlers, which only run
 * on the client.
 *
 * Known gaps vs Layout.tsx (acceptable for the native migration, revisit later):
 *  - Always renders the signed-out menu. Auth state lives in localStorage
 *    (client-only); rendering it during SSR would cause a hydration mismatch.
 *  - Uses the Bloom SiteHeader, i.e. the layout when the ACCOUNTS_LAYOUT flag is
 *    off (no account dropdown). Matches prod with the flag disabled.
 */
import type { ReactNode } from "react"
import { AlertBox, FooterNav, FooterSection, SiteFooter, SiteHeader, t } from "@uic"
import type { LangItem } from "@uic"
import Markdown from "markdown-to-jsx"
import { getAssetPath } from "../lib/assetPaths"
import {
  getCurrentLanguage,
  getPathWithoutLanguagePrefix,
  getSfGovUrl,
  LANGUAGE_CONFIGS,
  renderInlineMarkup,
  type LanguagePrefix,
} from "../../../app/javascript/util/languageUtil"
import { cleanPath } from "../../../app/javascript/util/urlUtil"

// Header/footer chrome overrides (feedback-link, header border, dropdown tweaks).
// The Bloom @uic SiteHeader/SiteFooter import their own base CSS; this layers the
// Dahlia-specific overrides on top, the same file Layout.tsx uses for bridged pages.
import "../../../app/javascript/layouts/Layout.css"

// Inlined copy of routeUtil.getLocalizedPath. We can't import routeUtil here:
// its module top-level builds SignInRedirectUrls by CALLING localizedPathGetter()
// (default arg reads window.location.pathname), which throws during SSR module
// eval. This helper only uses SSR-safe languageUtil/urlUtil pieces.
const getLocalizedPath = (
  newPath: string,
  language: LanguagePrefix,
  queryString?: string
): string => {
  const pathWithoutLang = getPathWithoutLanguagePrefix(newPath)
  const config = LANGUAGE_CONFIGS[language]
  const cleaned = cleanPath(config.isDefault ? pathWithoutLang : `${config.prefix}${pathWithoutLang}`)
  return `${cleaned}${queryString || ""}`
}

const getDisclaimerPath = (pathname: string) =>
  getLocalizedPath("/disclaimer", getCurrentLanguage(pathname))
const getPrivacyPolicyPath = (pathname: string) =>
  getLocalizedPath("/privacy", getCurrentLanguage(pathname))

interface AppShellProps {
  pathname: string
  children: ReactNode
}

const getLanguageItems = (pathname: string): LangItem[] =>
  Object.values(LANGUAGE_CONFIGS).map((item) => ({
    active: getCurrentLanguage(pathname) === item.prefix,
    label: item.getLabel(),
    onClick: () => {
      // Runs on the client only (user interaction), so window is available.
      window.location.href = getLocalizedPath(
        window.location.pathname,
        item.prefix,
        window.location.search
      )
    },
  }))

const getMenuLinks = () => [
  { title: t("nav.rent"), href: "/listings/for-rent" },
  { title: t("nav.buy"), href: "/listings/for-sale" },
  { title: t("nav.getAssistance"), href: "/get-assistance" },
  { title: t("nav.signIn"), href: "/sign-in" },
]

export function AppShell({ pathname, children }: AppShellProps) {
  const feedbackBanner = (
    <div className="feedback-link">
      {renderInlineMarkup(
        t("nav.getFeedback", {
          feedbackUrl: `https://airtable.com/appUW1tM8te0Lmf6q/pagyZulZJCm1V4G8D/form?prefill_Last%20visited=${encodeURIComponent(pathname)}&hide_Last%20visited=true`,
        })
      )}
    </div>
  )

  const topAlert = process.env.TOP_MESSAGE ? (
    <AlertBox
      type={process.env.TOP_MESSAGE_TYPE === "notice" ? "notice" : "alert"}
      inverted={process.env.TOP_MESSAGE_INVERTED === "true"}
      narrow
      boundToLayoutWidth
    >
      <Markdown>{process.env.TOP_MESSAGE}</Markdown>
    </AlertBox>
  ) : null

  return (
    <div className="notranslate site-wrapper">
      <div className="site-content">
        {topAlert}
        <SiteHeader
          homeURL={"/"}
          dropdownItemClassName={"text-2xs"}
          languageNavLabel={t("languages.choose")}
          languages={getLanguageItems(pathname)}
          logoSrc={getAssetPath("DAHLIA-logo.svg")}
          notice={feedbackBanner}
          noticeMobile={true}
          mobileDrawer={true}
          flattenSubMenus={true}
          imageOnly={true}
          mobileText={true}
          logoWidth={"medium"}
          logoClass="translate"
          menuLinks={getMenuLinks()}
          strings={{
            skipToMainContent: t("t.skipToMainContent"),
            logoAriaLable: t("t.dahliaSanFranciscoHousingPortal"),
          }}
          mainContentId={"main-content"}
        />

        <main data-testid="main-content-test-id" id="main-content">
          {children}
        </main>
      </div>

      <SiteFooter>
        <FooterSection>
          <img src={getAssetPath("logo-city.png")} alt="" data-testid="footer-logo-test-id" />
        </FooterSection>
        <FooterSection small>
          <p className="text-gray-500">
            <Markdown>
              {t("footer.dahliaDescription", {
                mohcdUrl: getSfGovUrl(
                  "https://sf.gov/departments/mayors-office-housing-and-community-development",
                  pathname
                ),
              })}
            </Markdown>
          </p>
          <p className="text-xs mt-4 text-gray-500">
            <Markdown>
              {t("footer.inPartnershipWith", {
                sfdsUrl: getSfGovUrl(
                  "https://sf.gov/departments/city-administrator/digital-services",
                  pathname
                ),
                mayorUrl: getSfGovUrl(
                  "https://sf.gov/departments/mayors-office-innovation",
                  pathname
                ),
              })}
            </Markdown>
          </p>
        </FooterSection>

        <FooterSection>
          <p className="text-sm">
            {t("footer.forListingQuestions")} <br />
            {t("footer.forGeneralQuestions")}
          </p>
        </FooterSection>
        <FooterNav copyright={`© ${t("footer.cityCountyOfSf")}`}>
          <a
            className="text-gray-500"
            href={`https://airtable.com/appUW1tM8te0Lmf6q/pagyZulZJCm1V4G8D/form?prefill_Last+visited=${encodeURIComponent(pathname)}&hide_Last+visited=true`}
            target="_blank"
            rel="noreferrer"
          >
            {t("footer.giveFeedback")}
          </a>
          <a className="text-gray-500" href="mailto:sfhousinginfo@sfgov.org">
            {t("footer.contact")}
          </a>
          <a className="text-gray-500" href={getDisclaimerPath(pathname)}>
            {t("footer.disclaimer")}
          </a>
          <a className="text-gray-500" href={getPrivacyPolicyPath(pathname)}>
            {t("footer.privacyPolicy")}
          </a>
        </FooterNav>
      </SiteFooter>
    </div>
  )
}
