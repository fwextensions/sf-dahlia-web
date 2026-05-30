/**
 * Step: Preferences - Select housing preferences and upload proof documents.
 * Integrates S3 file upload.
 */

import type { PreferenceFormData, UploadedFileRef } from "../../../lib/apply/types"

interface StepPreferencesProps {
  preferences: PreferenceFormData[]
  onPreferencesChange: (prefs: PreferenceFormData[]) => void
  onFileUpload: (
    file: File,
    documentType: string,
    listingPreferenceId?: string
  ) => Promise<UploadedFileRef | null>
  onNext: () => void
  onPrevious: () => void
}

export function StepPreferences({
  preferences,
  onPreferencesChange,
  onFileUpload,
  onNext,
  onPrevious,
}: StepPreferencesProps) {
  const handleToggle = (index: number) => {
    const updated = [...preferences]
    updated[index] = { ...updated[index], optedIn: !updated[index].optedIn }
    onPreferencesChange(updated)
  }

  const handleFileChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const pref = preferences[index]
    const result = await onFileUpload(file, "preference_proof", pref.preferenceId)

    if (result) {
      const updated = [...preferences]
      updated[index] = { ...updated[index], proofDocument: result }
      onPreferencesChange(updated)
    }
  }

  return (
    <section aria-labelledby="step-preferences-heading">
      <h2 id="step-preferences-heading">Preferences</h2>
      <p>
        Select any preferences you qualify for. You may need to provide proof documentation.
      </p>

      {preferences.length === 0 ? (
        <p>No preferences available for this listing.</p>
      ) : (
        <ul aria-label="Available preferences">
          {preferences.map((pref, i) => (
            <li key={pref.preferenceId}>
              <label>
                <input
                  type="checkbox"
                  checked={pref.optedIn}
                  onChange={() => handleToggle(i)}
                />
                {pref.preferenceName}
              </label>

              {pref.optedIn && (
                <div>
                  <label htmlFor={`pref-file-${i}`}>Upload proof document</label>
                  <input
                    id={`pref-file-${i}`}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange(i, e)}
                  />
                  {pref.proofDocument && (
                    <p>Uploaded: {pref.proofDocument.fileName}</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div>
        <button type="button" onClick={onPrevious}>Previous</button>
        <button type="button" onClick={onNext}>Next</button>
      </div>
    </section>
  )
}
