/**
 * Privacy Policy page component.
 *
 * Displays the DAHLIA privacy policy covering information collection,
 * cookies, sharing, analytics, links, security, and policy changes.
 */
import { createTranslatorSync } from "../i18n"
import type { TranslationDictionary } from "../i18n/types"

interface PrivacyProps {
  translations: TranslationDictionary | null
  fallbackTranslations: TranslationDictionary | null
}

export function Privacy({ translations, fallbackTranslations }: PrivacyProps) {
  const t = createTranslatorSync(translations, fallbackTranslations)

  return (
    <main>
      <header className="bg-gray-800 text-white py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold font-alt-serif">{t("pageTitle.privacy")}</h1>
          <p className="mt-2 text-lg opacity-90">{t("privacyPolicy.intro")}</p>
        </div>
      </header>
      <article className="max-w-5xl mx-auto w-full px-6">
        <div className="w-full md:w-2/3">
          <section className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("privacyPolicy.infoCollectionTitle")}</h2>
            <ul className="list-disc ml-7 space-y-2.5 text-gray-800">
              <li>{t("privacyPolicy.infoCollectionP1")}</li>
              <li>{t("privacyPolicy.infoCollectionP2")}</li>
              <li>{t("privacyPolicy.infoCollectionP3")}</li>
              <li>{t("privacyPolicy.infoCollectionP4")}</li>
            </ul>
          </section>
          <hr className="border-gray-300" />

          <section className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("privacyPolicy.infoYouProvideTitle")}</h2>
            <ul className="list-disc ml-7 space-y-2.5 text-gray-800">
              <li>{t("privacyPolicy.infoYouProvideP1")}</li>
              <li>{t("privacyPolicy.infoYouProvideP2")}</li>
              <li>{t("privacyPolicy.infoYouProvideP3")}</li>
            </ul>
          </section>
          <hr className="border-gray-300" />

          <section className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("privacyPolicy.cookiesTitle")}</h2>
            <ul className="list-disc ml-7 space-y-2.5 text-gray-800">
              <li>{t("privacyPolicy.cookiesP1")}</li>
              <li>{t("privacyPolicy.cookiesP2")}</li>
            </ul>
          </section>
          <hr className="border-gray-300" />

          <section className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("privacyPolicy.infoSharingTitle")}</h2>
            <ul className="list-disc ml-7 text-gray-800">
              <li>{t("privacyPolicy.infoSharingP1")}</li>
            </ul>
          </section>
          <hr className="border-gray-300" />

          <section className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("privacyPolicy.analyticsTitle")}</h2>
            <p className="text-gray-800">{t("privacyPolicy.analyticsP1")}</p>
          </section>
          <hr className="border-gray-300" />

          <section className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("privacyPolicy.linksTitle")}</h2>
            <ul className="list-disc ml-7 space-y-2.5 text-gray-800">
              <li>{t("privacyPolicy.linksP1")}</li>
              <li>{t("privacyPolicy.linksP2")}</li>
              <li>{t("privacyPolicy.linksP3")}</li>
            </ul>
          </section>
          <hr className="border-gray-300" />

          <section className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("privacyPolicy.siteSecurityTitle")}</h2>
            <ul className="list-disc ml-7 space-y-2.5 text-gray-800">
              <li>{t("privacyPolicy.siteSecurityP1")}</li>
              <li>{t("privacyPolicy.siteSecurityP2")}</li>
            </ul>
          </section>
          <hr className="border-gray-300" />

          <section className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("privacyPolicy.policyChangesTitle")}</h2>
            <ul className="list-disc ml-7 text-gray-800">
              <li>{t("privacyPolicy.policyChangesP1")}</li>
            </ul>
          </section>
          <hr className="border-gray-300" />

          <section className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("privacyPolicy.questionsTitle")}</h2>
            <p className="text-gray-800">{t("privacyPolicy.questionsP1")}</p>
          </section>
        </div>
      </article>
    </main>
  )
}
