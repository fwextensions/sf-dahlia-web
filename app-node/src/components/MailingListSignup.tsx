/**
 * Native MailingListSignup — SSR-safe port of
 * app/javascript/components/MailingListSignup.tsx (the styled variant with the
 * primary-lighter background and mail icon, used by content pages).
 */
import { ActionBlock, Heading, Icon, t } from "@uic"

// ConfigContext.listingsAlertUrl in the Rails app.
const LISTINGS_ALERT_URL = "https://confirmsubscription.com/h/y/C3BAFCD742D47910"

export function MailingListSignup() {
  return (
    <ActionBlock
      className="mt-4"
      header={<Heading priority={2}>{t("welcome.newListingEmailAlert")}</Heading>}
      background="primary-lighter"
      icon={<Icon size="3xl" symbol="mailThin" fill="transparent" />}
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
  )
}
