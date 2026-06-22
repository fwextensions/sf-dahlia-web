/**
 * Native disclaimer page (SSR). Ports
 * app/javascript/pages/getAssistance/disclaimer.tsx without Layout/withAppSetup.
 */
import { t, PageHeader } from "@uic"
import { MailingListSignup } from "../../components/MailingListSignup"
import bgImage from "../../../../app/assets/images/bg@1200.jpg"

export function Disclaimer() {
  return (
    <>
      <PageHeader
        title={t("pageTitle.disclaimer")}
        subtitle={t("disclaimer.intro")}
        inverse
        backgroundImage={bgImage}
      />
      <article className="flex flex-wrap relative max-w-5xl m-auto w-full">
        <div className="w-full md:w-2/3">
          <div className="space-y-4 p-6 md:py-11 md:pr-6 lg:pl-0">
            <h2>{t("disclaimer.liabilityTitle")}</h2>
            <p>{t("disclaimer.liabilityP1")}</p>
          </div>
          <div className="md:pr-11 md:pl-0">
            <hr />
          </div>
          <div className="space-y-4 p-6 md:py-11 md:pr-6 lg:pl-0">
            <h2>{t("disclaimer.copyrightTitle")}</h2>
            <p>{t("disclaimer.copyrightP1")}</p>
          </div>
          <div className="md:pr-11 md:pl-0">
            <hr />
          </div>
          <div className="space-y-4 p-6 md:py-11 md:pr-11 lg:pl-0">
            <h2>{t("disclaimer.browserCompatibilityTitle")}</h2>
            <p>{t("disclaimer.browserCompatibilityP1")}</p>
          </div>
        </div>
      </article>
      <span className="max-w-5xl m-auto w-full pb-8">
        <MailingListSignup />
      </span>
    </>
  )
}
