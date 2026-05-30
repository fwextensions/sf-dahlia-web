/**
 * HowToApply page component.
 *
 * This is the FCFS sales how-to-apply page. It renders static instructional
 * content from translations. When used on the listing-specific route
 * (/listings/:id/how-to-apply), listing data is provided via server function
 * (no client-side Rails API calls).
 */
import { createTranslatorSync } from "../i18n"
import type { TranslationDictionary } from "../i18n/types"
import type { SerializableListing } from "../lib/listings/server-fns"

interface HowToApplyProps {
  translations: TranslationDictionary | null
  fallbackTranslations: TranslationDictionary | null
  /** Listing data provided by server function on listing-specific routes */
  listing?: SerializableListing | null
}

export function HowToApply({ translations, fallbackTranslations, listing }: HowToApplyProps) {
  const t = createTranslatorSync(translations, fallbackTranslations)

  return (
    <main className="max-w-5xl mx-auto w-full px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-alt-serif">
          {t("pageTitle.howToApply")}
        </h1>
        <p className="mt-2 text-lg text-gray-700">
          {t("howToApplyPage.subTitle")}
        </p>
        {listing && (
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <p className="font-semibold">{listing.name}</p>
            <p className="text-gray-600">
              {listing.buildingAddress}, {listing.buildingCity},{" "}
              {listing.buildingState} {listing.buildingZip}
            </p>
            {listing.applicationDueDate && (
              <p className="mt-1 text-gray-700">
                <strong>Application Due:</strong> {listing.applicationDueDate}
              </p>
            )}
          </div>
        )}
      </header>

      {/* How Long It Takes */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">
          {t("howToApplyPage.howLongItTakesSection.title")}
        </h2>
        <h3 className="text-xl font-semibold pt-4 pb-2">
          {t("howToApplyPage.howLongItTakesSection.subtitle1")}
        </h3>
        <p className="text-gray-800">{t("howToApplyPage.howLongItTakesSection.p1")}</p>
        <h3 className="text-xl font-semibold pt-4 pb-2">
          {t("howToApplyPage.howLongItTakesSection.subtitle2")}
        </h3>
        <p className="text-gray-800">{t("howToApplyPage.howLongItTakesSection.p2")}</p>
      </section>

      {/* Before You Start */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">
          {t("howToApplyPage.beforeYouStartSection.title")}
        </h2>
        <h3 className="text-xl font-semibold pt-4 pb-2">
          {t("howToApplyPage.beforeYouStartSection.subtitle1")}
        </h3>
        <p className="text-gray-800 mb-2">
          {t("howToApplyPage.beforeYouStartSection.eligibilityList.title")}
        </p>
        <ul className="list-disc ml-7 space-y-1 text-gray-800">
          <li>{t("howToApplyPage.beforeYouStartSection.eligibilityList.listItem1")}</li>
          <li>{t("howToApplyPage.beforeYouStartSection.eligibilityList.listItem2")}</li>
          <li>{t("howToApplyPage.beforeYouStartSection.eligibilityList.listItem3")}</li>
          <li>{t("howToApplyPage.beforeYouStartSection.eligibilityList.listItem4")}</li>
          <li>{t("howToApplyPage.beforeYouStartSection.eligibilityList.listItem5")}</li>
        </ul>
        <h3 className="text-xl font-semibold pt-6 pb-2">
          {t("howToApplyPage.beforeYouStartSection.subtitle2")}
        </h3>
        <p className="text-gray-800">{t("howToApplyPage.beforeYouStartSection.p2")}</p>
      </section>

      {/* How to Apply Steps */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">
          {t("pageTitle.howToApply.lowercase")}
        </h2>
        <ol className="list-decimal ml-7 space-y-6">
          <li>
            <h3 className="text-xl font-semibold pb-2">
              {t("listings.fcfs.bmrSales.howToApply.step1")}
            </h3>
            <p className="text-gray-800 pb-2">{t("howToApplyPage.howToApplySection.step1.p1")}</p>
            <p className="text-gray-800">{t("howToApplyPage.howToApplySection.step1.p2")}</p>
          </li>
          <li>
            <h3 className="text-xl font-semibold pb-2">
              {t("listings.fcfs.bmrSales.howToApply.step2")}
            </h3>
            <p className="text-gray-800">{t("howToApplyPage.howToApplySection.step2.p1")}</p>
          </li>
          <li>
            <h3 className="text-xl font-semibold pb-2">
              {t("howToApplyPage.howToApplySection.step3.title")}
            </h3>
            <p className="text-gray-800">{t("howToApplyPage.howToApplySection.step3.p1")}</p>
          </li>
          <li>
            <h3 className="text-xl font-semibold pb-2">
              {t("howToApplyPage.howToApplySection.step4.title")}
            </h3>
            <p className="text-gray-800">{t("howToApplyPage.howToApplySection.step4.p1")}</p>
            <p className="text-gray-800">{t("howToApplyPage.howToApplySection.step4.p2")}</p>
          </li>
          <li>
            <h3 className="text-xl font-semibold pb-2">
              {t("howToApplyPage.howToApplySection.step5.title")}
            </h3>
            <p className="text-gray-800">{t("howToApplyPage.howToApplySection.step5.p1.v2")}</p>
          </li>
        </ol>
      </section>

      {/* What Happens Next */}
      <section>
        <h2 className="text-2xl font-bold mb-4">
          {t("howToApplyPage.whatHappensNext.title")}
        </h2>
        <p className="text-gray-800 mb-2">{t("howToApplyPage.whatHappensNext.p1")}</p>
        <p className="text-gray-800">{t("howToApplyPage.whatHappensNext.p2")}</p>
      </section>
    </main>
  )
}
