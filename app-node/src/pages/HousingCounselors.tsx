/**
 * HousingCounselors page component.
 *
 * Displays a filterable list of housing counselors with contact information.
 * Data is static from housing_counselors_react.json.
 */
import { useState, useMemo } from "react"
import { createTranslatorSync } from "../i18n"
import type { TranslationDictionary } from "../i18n/types"
import housingCounselorsList from "../../../app/assets/json/housing_counselors_react.json"

interface HousingCounselorsProps {
  translations: TranslationDictionary | null
  fallbackTranslations: TranslationDictionary | null
}

interface Address {
  label_key?: string
  street: string
  cityState: string
}

interface CounselorData {
  fullName: string
  shortName?: string
  services: string[]
  languages: string[]
  address: Address[]
  website: string
  email: string
  phone: string
  extension?: string
}

const HOME_SF: CounselorData = {
  fullName: "Home SF (Rentals and Ownership)",
  shortName: "Home SF",
  services: ["rental", "ownership"],
  languages: ["english", "filipino", "spanish"],
  address: [{ street: "275 5th Street #314", cityState: "San Francisco, CA 94103" }],
  website: "https://www.homesanfrancisco.org/",
  email: "info@homesanfrancisco.org",
  phone: "(415) 202-5464",
}

function CounselorCard({
  counselor,
  t,
}: {
  counselor: CounselorData
  t: (key: string, interpolations?: Record<string, string>) => string
}) {
  return (
    <div className="pb-4 mt-4 border-b border-gray-300 last:border-b-0">
      <h3 className="text-lg font-semibold mb-2">{counselor.fullName}</h3>
      <p className="text-xs text-gray-700 mb-1">
        {t("assistance.housingCounselors.servicesOffered")}{" "}
        {counselor.services.map((service) => (
          <span
            key={service}
            className="inline-block mr-1 px-2 py-0.5 bg-gray-200 rounded text-xs"
          >
            {t(`assistance.housingCounselors.services.${service}`)}
          </span>
        ))}
      </p>
      <p className="text-xs text-gray-700 mb-3">
        {t("assistance.housingCounselors.languagesSpoken")}{" "}
        {counselor.languages.map((lang) => (
          <span
            key={lang}
            className="inline-block mr-1 px-2 py-0.5 bg-blue-100 rounded text-xs"
          >
            {t(`assistance.housingCounselors.services.languages.${lang}`)}
          </span>
        ))}
      </p>
      <div className="space-y-1 text-sm text-gray-800">
        {counselor.address.map((addr, idx) => (
          <div key={idx}>
            {addr.label_key && <span className="font-semibold">{t(addr.label_key)} </span>}
            <span>{addr.street}, {addr.cityState}</span>
          </div>
        ))}
        <div className="flex flex-col sm:flex-row gap-3 mt-3">
          <a href={`tel:${counselor.phone}`} className="text-blue-700 hover:underline">
            {counselor.phone}
            {counselor.extension && ` ${counselor.extension}`}
          </a>
          <a href={`mailto:${counselor.email}`} className="text-blue-700 hover:underline">
            {counselor.email}
          </a>
          {counselor.website && (
            <a
              href={counselor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline"
            >
              {t("assistance.housingCounselors.counselor.visitWebsite.lower", {
                counselorName: counselor.shortName || counselor.fullName,
              })}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export function HousingCounselors({ translations, fallbackTranslations }: HousingCounselorsProps) {
  const t = createTranslatorSync(translations, fallbackTranslations)
  const [languageFilter, setLanguageFilter] = useState("any")
  const [serviceFilter, setServiceFilter] = useState<string[]>([])

  const filteredList = useMemo(() => {
    let list = housingCounselorsList.counselors as CounselorData[]
    if (languageFilter !== "any") {
      list = list.filter((c) => c.languages.includes(languageFilter))
    }
    if (serviceFilter.length > 0) {
      list = list.filter((c) => c.services.some((s) => serviceFilter.includes(s)))
    }
    return list
  }, [languageFilter, serviceFilter])

  const handleServiceToggle = (service: string) => {
    setServiceFilter((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    )
  }

  return (
    <main className="max-w-5xl mx-auto w-full px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-alt-serif">
          {t("assistance.title.housingCouneslors")}
        </h1>
        <p className="mt-2 text-lg text-gray-700">
          {t("assistance.subtitle.housingCouneslors")}
        </p>
      </header>

      {/* Start Here - Home SF */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-2">
          {t("assistance.housingCounselors.startHere.title")}
        </h2>
        <p className="text-gray-700 mb-4">
          {t("assistance.housingCounselors.startHere.subtitle")}
        </p>
        <CounselorCard counselor={HOME_SF} t={t} />
      </section>

      <hr className="my-8 border-gray-300" />

      {/* Filter controls */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div>
            <label htmlFor="language-filter" className="block text-sm font-medium mb-1">
              {t("assistance.housingCounselors.languagesSpoken")}
            </label>
            <select
              id="language-filter"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="any">
                {t("assistance.housingCounselors.findACounselor.filter.all")}
              </option>
              <option value="cantonese">{t("assistance.housingCounselors.services.languages.cantonese")}</option>
              <option value="english">{t("assistance.housingCounselors.services.languages.english")}</option>
              <option value="filipino">{t("assistance.housingCounselors.services.languages.filipino")}</option>
              <option value="mandarin">{t("assistance.housingCounselors.services.languages.mandarin")}</option>
              <option value="russian">{t("assistance.housingCounselors.services.languages.russian")}</option>
              <option value="spanish">{t("assistance.housingCounselors.services.languages.spanish")}</option>
              <option value="vietnamese">{t("assistance.housingCounselors.services.languages.vietnamese")}</option>
            </select>
          </div>
          <div>
            <span className="block text-sm font-medium mb-1">
              {t("assistance.housingCounselors.servicesOffered")}
            </span>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={serviceFilter.includes("rental")}
                  onChange={() => handleServiceToggle("rental")}
                />
                {t("assistance.housingCounselors.services.rental")}
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={serviceFilter.includes("ownership")}
                  onChange={() => handleServiceToggle("ownership")}
                />
                {t("assistance.housingCounselors.services.ownership")}
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLanguageFilter("any")
              setServiceFilter([])
            }}
            className="text-blue-700 underline self-end text-sm"
          >
            Clear filters
          </button>
        </div>
      </section>

      {/* Results */}
      <section>
        <h3 className="text-lg font-semibold mb-4">
          {filteredList.length === (housingCounselorsList.counselors as CounselorData[]).length
            ? t("assistance.housingCounselors.findACounselor.filter.all")
            : filteredList.length === 0
              ? t("assistance.housingCounselors.findACounselor.filter.zero.part1")
              : t("assistance.housingCounselors.findACounselor.filter.results", {
                  num: String(filteredList.length),
                })}
        </h3>
        {filteredList.map((counselor) => (
          <CounselorCard key={counselor.fullName} counselor={counselor} t={t} />
        ))}
      </section>
    </main>
  )
}
