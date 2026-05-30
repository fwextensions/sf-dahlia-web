/**
 * HomePage component for DAHLIA San Francisco Housing Portal.
 *
 * Renders the welcome hero section with links to rental and sale listings.
 * Client-side data fetching (e.g., featured listings) happens after hydration
 * using the RAILS_API_BASE_URL.
 */
import { createTranslatorSync } from "../i18n"
import type { TranslationDictionary } from "../i18n/types"

interface HomePageProps {
  translations: TranslationDictionary | null
  fallbackTranslations: TranslationDictionary | null
  locale: string
}

export function HomePage({ translations, fallbackTranslations, locale }: HomePageProps) {
  const t = createTranslatorSync(translations, fallbackTranslations)

  const rentalPath = locale === "en" ? "/listings/for-rent" : `/${locale}/listings/for-rent`
  const salePath = locale === "en" ? "/listings/for-sale" : `/${locale}/listings/for-sale`

  return (
    <main>
      <section
        className="relative bg-cover bg-center py-24 px-6 text-center text-white"
        aria-label={t("welcome.title")}
      >
        <div className="absolute inset-0 bg-gray-900 opacity-50" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold font-alt-serif mb-6">
            {t("welcome.title")}
          </h1>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <a
              href={rentalPath}
              className="inline-block px-8 py-3 bg-blue-700 text-white font-semibold rounded hover:bg-blue-800 transition"
            >
              {t("welcome.see_rental_listings")}
            </a>
            <a
              href={salePath}
              className="inline-block px-8 py-3 bg-white text-blue-700 font-semibold rounded hover:bg-gray-100 transition"
            >
              {t("welcome.see_sale_listings")}
            </a>
          </div>
        </div>
      </section>
      <section className="max-w-4xl mx-auto py-12 px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">{t("welcome.new_listing_email_alert")}</h2>
        <a
          href="https://confirmsubscription.com/h/y/EA519CC9A3D0609E"
          className="inline-block px-6 py-3 bg-blue-700 text-white font-semibold rounded hover:bg-blue-800 transition"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("welcome.sign_up_today")}
        </a>
      </section>
    </main>
  )
}
