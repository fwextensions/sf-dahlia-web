/**
 * Disclaimer page component.
 *
 * Displays liability, copyright, and browser compatibility disclaimers.
 */
import { createTranslatorSync } from "../i18n"
import type { TranslationDictionary } from "../i18n/types"

interface DisclaimerProps {
  translations: TranslationDictionary | null
  fallbackTranslations: TranslationDictionary | null
}

export function Disclaimer({ translations, fallbackTranslations }: DisclaimerProps) {
  const t = createTranslatorSync(translations, fallbackTranslations)

  return (
    <main>
      <header className="bg-gray-800 text-white py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold font-alt-serif">{t("pageTitle.disclaimer")}</h1>
          <p className="mt-2 text-lg opacity-90">{t("disclaimer.intro")}</p>
        </div>
      </header>
      <article className="max-w-5xl mx-auto w-full px-6">
        <div className="w-full md:w-2/3">
          <div className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("disclaimer.liabilityTitle")}</h2>
            <p className="text-gray-800">{t("disclaimer.liabilityP1")}</p>
          </div>
          <hr className="border-gray-300" />
          <div className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("disclaimer.copyrightTitle")}</h2>
            <p className="text-gray-800">{t("disclaimer.copyrightP1")}</p>
          </div>
          <hr className="border-gray-300" />
          <div className="space-y-4 py-8 md:py-11">
            <h2 className="text-xl font-bold">{t("disclaimer.browserCompatibilityTitle")}</h2>
            <p className="text-gray-800">{t("disclaimer.browserCompatibilityP1")}</p>
          </div>
        </div>
      </article>
    </main>
  )
}
