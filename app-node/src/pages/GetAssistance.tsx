/**
 * GetAssistance page component.
 *
 * Hub page linking to housing counselors, additional resources,
 * document checklist, SF services, and DAHLIA videos.
 */
import { createTranslatorSync } from "../i18n"
import type { TranslationDictionary } from "../i18n/types"

interface GetAssistanceProps {
  translations: TranslationDictionary | null
  fallbackTranslations: TranslationDictionary | null
  locale: string
}

function getLocalizedPath(path: string, locale: string): string {
  return locale === "en" ? path : `/${locale}${path}`
}

export function GetAssistance({ translations, fallbackTranslations, locale }: GetAssistanceProps) {
  const t = createTranslatorSync(translations, fallbackTranslations)

  const sections = [
    {
      title: t("assistance.title.housingCouneslors"),
      subtitle: t("assistance.subtitle.housingCouneslors"),
      href: getLocalizedPath("/housing-counselors", locale),
      buttonText: t("housingCounselor.findAHousingCounselor"),
    },
    {
      title: t("assistance.title.additionalHousingOpportunities"),
      subtitle: t("assistance.subtitle.additionalHousingOpportunities"),
      href: getLocalizedPath("/additional-resources", locale),
      buttonText: t("assistance.title.additionalHousingOpportunities.button"),
    },
    {
      title: t("assistance.title.sfServices"),
      subtitle: t("assistance.subtitle.sfServices"),
      href: "https://sfserviceguide.org/",
      buttonText: t("assistance.title.sfServices.button"),
      external: true,
    },
    {
      title: t("assistance.title.documentChecklist"),
      subtitle: t("assistance.subtitle.documentChecklist"),
      href: getLocalizedPath("/document-checklist", locale),
      buttonText: t("label.viewDocumentChecklist"),
    },
    {
      title: t("assistance.title.dahliaVideos"),
      subtitle: t("assistance.subtitle.dahliaVideos"),
      href: "https://www.youtube.com/playlist?list=PL7dcWHJTcA51TBqhghJ9LfSGEGoFB7aWG",
      buttonText: t("assistance.title.dahliaVideos.button"),
      external: true,
    },
  ]

  return (
    <main className="max-w-5xl mx-auto w-full px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-alt-serif">
          {t("assistance.title.getAssistance")}
        </h1>
        <p className="mt-2 text-lg text-gray-700">
          {t("assistance.subtitle.getAssistance")}
        </p>
      </header>
      <div className="space-y-6">
        {sections.map((section, index) => (
          <section
            key={section.title}
            className={`p-6 rounded-lg ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}
          >
            <h2 className="text-xl font-bold mb-2">{section.title}</h2>
            <p className="text-gray-700 mb-4">{section.subtitle}</p>
            <a
              href={section.href}
              className="inline-block px-6 py-2 bg-blue-700 text-white font-semibold rounded hover:bg-blue-800 transition"
              {...(section.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {section.buttonText}
            </a>
          </section>
        ))}
      </div>
    </main>
  )
}
