/**
 * ListingApplyForm - Multi-step application form.
 *
 * Steps: intro → you → household → preferences → income → review → submit
 *
 * On load, checks for an existing draft (by SF contact ID + listing ID) and
 * pre-populates the form if one is found. Supports auto-save of drafts.
 *
 * Requirements: 7.5, 7.6
 */

import { useCallback, useEffect, useState } from "react"
import { useApplicationForm } from "../../lib/apply/useApplicationForm"
import {
  getDraftApplication,
  saveDraft,
  uploadFile,
  validateApplicationAddress,
} from "../../lib/apply/server-fns"
import type {
  DraftApplicationData,
  DraftApplicationResult,
  UploadFileResult,
} from "../../lib/apply/server-fns"
import type {
  ApplicationFormState,
  ApplicationStep,
  UploadedFileRef,
} from "../../lib/apply/types"
import { StepIntro } from "./steps/StepIntro"
import { StepYou } from "./steps/StepYou"
import { StepHousehold } from "./steps/StepHousehold"
import { StepPreferences } from "./steps/StepPreferences"
import { StepIncome } from "./steps/StepIncome"
import { StepReview } from "./steps/StepReview"

interface ListingApplyFormProps {
  listingId: string
  listingName?: string
}

export function ListingApplyForm({ listingId, listingName }: ListingApplyFormProps) {
  const form = useApplicationForm(listingId)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ============================================================
  // Draft resume on mount
  // ============================================================

  useEffect(() => {
    let cancelled = false

    async function loadDraft() {
      try {
        const result = await getDraftApplication({ data: { listingId } }) as DraftApplicationResult
        if (!cancelled && result.found && result.application) {
          form.loadDraft(mapDraftToFormState(result.application))
          if (result.application.id) {
            form.setApplicationId(result.application.id)
          }
        }
      } catch {
        // If draft lookup fails (e.g., not authenticated), proceed with empty form
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDraft()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId])

  // ============================================================
  // Save draft
  // ============================================================

  const handleSaveDraft = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const draftData = mapFormStateToDraft(form.state)
      const result = await saveDraft({ data: draftData }) as DraftApplicationData
      if (result.id && !form.state.applicationId) {
        form.setApplicationId(result.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft")
    } finally {
      setSaving(false)
    }
  }, [form])

  // ============================================================
  // File upload
  // ============================================================

  const handleFileUpload = useCallback(async (
    file: File,
    documentType: string,
    listingPreferenceId?: string
  ): Promise<UploadedFileRef | null> => {
    try {
      const buffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      )

      const result = await uploadFile({
        data: {
          fileName: file.name,
          contentType: file.type,
          fileContent: base64,
          listingId,
          documentType,
          listingPreferenceId,
        },
      }) as UploadFileResult

      const fileRef: UploadedFileRef = {
        url: result.url,
        key: result.key,
        fileName: result.fileName,
        contentType: result.contentType,
        documentType,
        listingPreferenceId,
      }

      form.addUploadedFile(fileRef)
      return fileRef
    } catch (e) {
      setError(e instanceof Error ? e.message : "File upload failed")
      return null
    }
  }, [listingId, form])

  // ============================================================
  // Address validation
  // ============================================================

  const handleValidateAddress = useCallback(async (address: {
    street1: string
    street2?: string
    city: string
    state: string
    zip: string
  }) => {
    const result = await validateApplicationAddress({ data: address })
    return result
  }, [])

  // ============================================================
  // Step navigation with auto-save
  // ============================================================

  const handleNext = useCallback(async () => {
    // Auto-save draft when advancing
    await handleSaveDraft()
    form.nextStep()
  }, [form, handleSaveDraft])

  const handlePrevious = useCallback(() => {
    form.previousStep()
  }, [form])

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <main aria-busy="true">
        <p>Loading application...</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Apply for {listingName ?? "Listing"}</h1>

      {form.state.isDraft && (
        <p role="status" aria-live="polite">
          Resuming your saved draft application.
        </p>
      )}

      {error && (
        <div role="alert" aria-live="assertive">
          <p>{error}</p>
        </div>
      )}

      <StepProgressBar currentStep={form.state.currentStep} />

      <div>
        {form.state.currentStep === "intro" && (
          <StepIntro
            listingId={listingId}
            onNext={handleNext}
          />
        )}
        {form.state.currentStep === "you" && (
          <StepYou
            applicant={form.state.applicant}
            alternateContact={form.state.alternateContact}
            onApplicantChange={form.setApplicant}
            onAlternateContactChange={form.setAlternateContact}
            onValidateAddress={handleValidateAddress}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}
        {form.state.currentStep === "household" && (
          <StepHousehold
            members={form.state.householdMembers}
            onMembersChange={form.setHouseholdMembers}
            onAddMember={form.addHouseholdMember}
            onRemoveMember={form.removeHouseholdMember}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}
        {form.state.currentStep === "preferences" && (
          <StepPreferences
            preferences={form.state.preferences}
            onPreferencesChange={form.setPreferences}
            onFileUpload={handleFileUpload}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}
        {form.state.currentStep === "income" && (
          <StepIncome
            income={form.state.income}
            onIncomeChange={form.setIncome}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}
        {form.state.currentStep === "review" && (
          <StepReview
            formState={form.state}
            onPrevious={handlePrevious}
            onSubmit={handleSaveDraft}
          />
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
      </div>
    </main>
  )
}

// ============================================================
// Step progress indicator
// ============================================================

function StepProgressBar({ currentStep }: { currentStep: ApplicationStep }) {
  const steps: { key: ApplicationStep; label: string }[] = [
    { key: "intro", label: "Intro" },
    { key: "you", label: "You" },
    { key: "household", label: "Household" },
    { key: "preferences", label: "Preferences" },
    { key: "income", label: "Income" },
    { key: "review", label: "Review" },
    { key: "submit", label: "Submit" },
  ]

  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  return (
    <nav aria-label="Application progress">
      <ol>
        {steps.map((step, i) => (
          <li
            key={step.key}
            aria-current={i === currentIndex ? "step" : undefined}
          >
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// ============================================================
// Draft mapping helpers
// ============================================================

function mapDraftToFormState(
  draft: DraftApplicationData
): Partial<ApplicationFormState> {
  const result: Partial<ApplicationFormState> = {}

  if (draft.primaryApplicant) {
    const pa = draft.primaryApplicant
    result.applicant = {
      firstName: pa.firstName ?? "",
      lastName: pa.lastName ?? "",
      email: pa.email ?? "",
      DOB: pa.DOB ?? "",
      phone: pa.phone ?? "",
      address: {
        street1: pa.street1 ?? "",
        street2: pa.street2 ?? "",
        city: pa.city ?? "",
        state: pa.state ?? "",
        zip: pa.zip ?? "",
      },
      mailingAddress: null,
      alternatePhone: pa.alternatePhone ?? "",
      alternatePhoneType: pa.alternatePhoneType ?? "",
    }
  }

  if (draft.alternateContact) {
    const ac = draft.alternateContact
    result.alternateContact = {
      firstName: ac.firstName ?? "",
      lastName: ac.lastName ?? "",
      email: ac.email ?? "",
      phone: ac.phone ?? "",
      alternateContactType: ac.alternateContactType ?? "",
      agency: ac.agency ?? "",
    }
  }

  if (draft.householdMembers && draft.householdMembers.length > 0) {
    result.householdMembers = draft.householdMembers.map((member) => ({
      firstName: member.firstName,
      lastName: member.lastName,
      DOB: member.DOB ?? "",
      relationship: member.relationship ?? "",
    }))
  }

  if (draft.annualIncome != null || draft.monthlyIncome != null) {
    result.income = {
      incomeTimeframe: draft.annualIncome ? "per_year" : "per_month",
      incomeTotal: draft.annualIncome ?? draft.monthlyIncome ?? 0,
    }
  }

  return result
}

function mapFormStateToDraft(state: ApplicationFormState) {
  return {
    listingID: state.listingId,
    applicationId: state.applicationId ?? undefined,
    primaryApplicant: {
      firstName: state.applicant.firstName,
      lastName: state.applicant.lastName,
      email: state.applicant.email || null,
      DOB: state.applicant.DOB || null,
      phone: state.applicant.phone || undefined,
      street1: state.applicant.address.street1 || undefined,
      street2: state.applicant.address.street2 || undefined,
      city: state.applicant.address.city || undefined,
      state: state.applicant.address.state || undefined,
      zip: state.applicant.address.zip || undefined,
    },
    alternateContact: state.alternateContact.firstName
      ? {
          firstName: state.alternateContact.firstName || null,
          lastName: state.alternateContact.lastName || null,
          email: state.alternateContact.email || null,
          phone: state.alternateContact.phone || null,
        }
      : null,
    householdMembers: state.householdMembers.map((m) => ({
      firstName: m.firstName,
      lastName: m.lastName,
      DOB: m.DOB || null,
    })),
    shortFormPreferences: state.preferences
      .filter((p) => p.optedIn)
      .map((p) => ({
        preferenceId: p.preferenceId,
        preferenceName: p.preferenceName,
      })),
    annualIncome:
      state.income.incomeTimeframe === "per_year" ? state.income.incomeTotal : undefined,
    monthlyIncome:
      state.income.incomeTimeframe === "per_month" ? state.income.incomeTotal : undefined,
  }
}
