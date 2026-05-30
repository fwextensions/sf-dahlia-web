/**
 * DocumentChecklist page component.
 *
 * Displays lottery preference document requirements and homebuyer documents.
 * Content is fully translation-driven.
 */
import { createTranslatorSync } from "../i18n"
import type { TranslationDictionary } from "../i18n/types"

interface DocumentChecklistProps {
  translations: TranslationDictionary | null
  fallbackTranslations: TranslationDictionary | null
}

export function DocumentChecklist({ translations, fallbackTranslations }: DocumentChecklistProps) {
  const t = createTranslatorSync(translations, fallbackTranslations)

  const proofItems = [
    "label.proof.telephoneBill",
    "label.proof.cableBill",
    "label.proof.electricBill",
    "label.proof.gasBill",
    "label.proof.waterBill",
    "label.proof.paystubHome",
    "label.proof.publicBenefits",
    "label.proof.schoolRecord",
    "label.proof.homelessness",
  ]

  return (
    <main className="max-w-5xl mx-auto w-full px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-alt-serif">
          {t("assistance.title.documentChecklist")}
        </h1>
        <p className="mt-2 text-lg text-gray-700">
          {t("assistance.subtitle.documentChecklist")}
        </p>
      </header>

      <section className="space-y-4 mb-8">
        <h2 className="text-2xl font-bold">{t("documentChecklist.preferenceHeader")}</h2>
        <p className="text-gray-800">{t("documentChecklist.p1")}</p>
        <p className="text-gray-800">{t("documentChecklist.p2")}</p>
        <p className="text-gray-800">{t("documentChecklist.p3")}</p>
      </section>

      {/* Neighborhood Residence Preference */}
      <details className="mb-4 border border-gray-300 rounded-lg">
        <summary className="p-4 font-semibold cursor-pointer bg-gray-100 rounded-lg">
          {t("listings.lotteryPreference.Neighborhood Resident Housing Preference (NRHP).title")}
        </summary>
        <div className="p-4 space-y-2">
          <p>{t("documentChecklist.nrhpDoc1")}</p>
          <p>{t("documentChecklist.nrhpDoc2")}</p>
          <ul className="list-disc ml-7">
            {proofItems.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      </details>

      {/* Live or Work Preference */}
      <details className="mb-4 border border-gray-300 rounded-lg">
        <summary className="p-4 font-semibold cursor-pointer bg-gray-100 rounded-lg">
          {t("listings.lotteryPreference.Live or Work in San Francisco Preference.title")}
        </summary>
        <div className="p-4 space-y-2">
          <p>{t("documentChecklist.twoWaysDesc")}</p>
          <ol className="list-decimal ml-7 space-y-4">
            <li>
              <p className="pb-2">{t("documentChecklist.liveSfDesc")}</p>
              <ul className="list-disc ml-4">
                {proofItems.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </li>
            <li>
              <p className="pb-2">{t("documentChecklist.workSfDesc")}</p>
              <ul className="list-disc ml-4">
                <li>{t("label.proof.paystubEmployer")}</li>
                <li>{t("label.proof.letterFromEmployer")}</li>
              </ul>
            </li>
          </ol>
        </div>
      </details>

      {/* Certificate of Preference */}
      <details className="mb-4 border border-gray-300 rounded-lg">
        <summary className="p-4 font-semibold cursor-pointer bg-gray-100 rounded-lg">
          {t("e7PreferencesPrograms.certOfPreference")}
        </summary>
        <div className="p-4 space-y-2">
          <p>{t("documentChecklist.copDoc1")}</p>
          <p>{t("documentChecklist.copDoc2")}</p>
        </div>
      </details>

      {/* Displaced Tenant */}
      <details className="mb-4 border border-gray-300 rounded-lg">
        <summary className="p-4 font-semibold cursor-pointer bg-gray-100 rounded-lg">
          {t("e7PreferencesPrograms.displaced")}
        </summary>
        <div className="p-4 space-y-2">
          <p>{t("documentChecklist.dthpDoc1")}</p>
          <p>{t("documentChecklist.dthpDoc2")}</p>
          <p>{t("documentChecklist.dthpDoc3")}</p>
        </div>
      </details>

      {/* Rent Burdened / Assisted Housing */}
      <details className="mb-4 border border-gray-300 rounded-lg">
        <summary className="p-4 font-semibold cursor-pointer bg-gray-100 rounded-lg">
          {t("listings.lotteryPreference.Rent Burdened / Assisted Housing Preference.title")}
        </summary>
        <div className="p-4 space-y-2">
          <p>{t("documentChecklist.ociiSponsored")}</p>
          <p>{t("documentChecklist.twoWaysDesc")}</p>
          <ol className="list-decimal ml-7 space-y-4">
            <li>
              <p className="pb-2">{t("documentChecklist.assistedHousingDesc")}</p>
              <ul className="list-disc ml-4">
                <li>{t("label.proof.leaseAgreement")}</li>
              </ul>
            </li>
            <li>
              <p className="pb-2">{t("documentChecklist.rentBurdenDoc1")}</p>
              <ul className="list-disc ml-4">
                <li>{t("label.proof.leaseAgreement")}</li>
                <li>{t("label.proof.moneyOrder")}</li>
                <li>{t("label.proof.cancelledCheck")}</li>
                <li>{t("label.proof.debitFromBank")}</li>
                <li>{t("label.proof.onlinePayment")}</li>
              </ul>
            </li>
          </ol>
        </div>
      </details>

      {/* HOPE SF */}
      <details className="mb-4 border border-gray-300 rounded-lg">
        <summary className="p-4 font-semibold cursor-pointer bg-gray-100 rounded-lg">
          {t("documentChecklist.hopeSfTitle")}
        </summary>
        <div className="p-4 space-y-2">
          <p>{t("documentChecklist.hopeSf.p1")}</p>
          <p>{t("documentChecklist.hopeSf.p2")}</p>
          <ul className="list-disc ml-7">
            <li>{t("label.proof.sfhaLetterVerifyingResidency")}</li>
            <li>{t("label.proof.sfhaLease")}</li>
            <li>{t("label.proof.sfCityId")}</li>
            <li>{t("label.proof.telephoneBill")}</li>
            <li>{t("label.proof.cableBill")}</li>
            <li>{t("label.proof.paystubHome")}</li>
            <li>{t("label.proof.publicBenefits")}</li>
            <li>{t("label.proof.schoolRecord")}</li>
          </ul>
        </div>
      </details>

      <hr className="my-8 border-gray-300" />

      {/* Homebuyer Documents */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t("documentChecklist.homebuyerHeader")}</h2>
        <p className="text-gray-800">{t("documentChecklist.homebuyerDesc")}</p>
        <ol className="list-decimal ml-7 space-y-2 text-gray-800">
          <li>{t("documentChecklist.homebuyerEducationDesc")}</li>
          <li>{t("documentChecklist.homebuyerLoanDesc")}</li>
        </ol>
        <p className="text-gray-800">{t("label.applicationUploadBothDocuments")}</p>
      </section>
    </main>
  )
}
