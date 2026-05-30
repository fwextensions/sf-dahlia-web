/**
 * AdditionalResources page component.
 *
 * Displays categorized housing resources with cards linking to external sites.
 * Data comes from the static additional-resources.json file.
 */
import { createTranslatorSync } from "../i18n"
import type { TranslationDictionary } from "../i18n/types"
import additionalResources from "../../../app/assets/json/additional-resources.json"

interface AdditionalResourcesProps {
  translations: TranslationDictionary | null
  fallbackTranslations: TranslationDictionary | null
}

export function AdditionalResources({ translations, fallbackTranslations }: AdditionalResourcesProps) {
  const t = createTranslatorSync(translations, fallbackTranslations)

  return (
    <main className="max-w-5xl mx-auto w-full px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-alt-serif">
          {t("assistance.title.additionalHousingOpportunities")}
        </h1>
        <p className="mt-2 text-lg text-gray-700">
          {t("assistance.subtitle.additionalHousingOpportunities")}
        </p>
      </header>
      <div className="space-y-12">
        {additionalResources.categories.map((category) => (
          <section key={category.title}>
            <h2 className="text-2xl font-bold mb-2">{t(category.title)}</h2>
            <p className="text-gray-700 mb-6">{t(category.subtitle)}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {category.resources.map((resource) => (
                <a
                  key={resource.title}
                  href={resource.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition bg-blue-50"
                >
                  <h3 className="font-semibold text-blue-800 mb-1">{t(resource.title)}</h3>
                  <p className="text-xs text-gray-600 mb-2">{t(resource.agency)}</p>
                  <p className="text-sm text-gray-800">{t(resource.description)}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
