/**
 * Multi-step application form state management hook.
 *
 * Manages form state across steps: intro → you → household → preferences → income → review → submit
 * Supports:
 * - Navigation between steps
 * - Draft save/resume
 * - File upload
 * - Address validation
 */

import { useCallback, useReducer } from "react"
import {
  APPLICATION_STEPS,
  createInitialFormState,
  type ApplicationFormState,
  type ApplicationStep,
  type ApplicantFormData,
  type AlternateContactFormData,
  type HouseholdMemberFormData,
  type PreferenceFormData,
  type IncomeFormData,
  type UploadedFileRef,
} from "./types"

// ============================================================
// Actions
// ============================================================

type FormAction =
  | { type: "SET_STEP"; step: ApplicationStep }
  | { type: "SET_APPLICATION_ID"; id: string }
  | { type: "SET_APPLICANT"; data: Partial<ApplicantFormData> }
  | { type: "SET_ALTERNATE_CONTACT"; data: Partial<AlternateContactFormData> }
  | { type: "SET_HOUSEHOLD_MEMBERS"; members: HouseholdMemberFormData[] }
  | { type: "ADD_HOUSEHOLD_MEMBER"; member: HouseholdMemberFormData }
  | { type: "REMOVE_HOUSEHOLD_MEMBER"; index: number }
  | { type: "SET_PREFERENCES"; preferences: PreferenceFormData[] }
  | { type: "SET_INCOME"; data: Partial<IncomeFormData> }
  | { type: "ADD_UPLOADED_FILE"; file: UploadedFileRef }
  | { type: "REMOVE_UPLOADED_FILE"; key: string }
  | { type: "LOAD_DRAFT"; state: Partial<ApplicationFormState> }
  | { type: "RESET" }

// ============================================================
// Reducer
// ============================================================

function formReducer(state: ApplicationFormState, action: FormAction): ApplicationFormState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step }
    case "SET_APPLICATION_ID":
      return { ...state, applicationId: action.id }
    case "SET_APPLICANT":
      return { ...state, applicant: { ...state.applicant, ...action.data } }
    case "SET_ALTERNATE_CONTACT":
      return { ...state, alternateContact: { ...state.alternateContact, ...action.data } }
    case "SET_HOUSEHOLD_MEMBERS":
      return { ...state, householdMembers: action.members }
    case "ADD_HOUSEHOLD_MEMBER":
      return { ...state, householdMembers: [...state.householdMembers, action.member] }
    case "REMOVE_HOUSEHOLD_MEMBER":
      return {
        ...state,
        householdMembers: state.householdMembers.filter((_, i) => i !== action.index),
      }
    case "SET_PREFERENCES":
      return { ...state, preferences: action.preferences }
    case "SET_INCOME":
      return { ...state, income: { ...state.income, ...action.data } }
    case "ADD_UPLOADED_FILE":
      return { ...state, uploadedFiles: [...state.uploadedFiles, action.file] }
    case "REMOVE_UPLOADED_FILE":
      return {
        ...state,
        uploadedFiles: state.uploadedFiles.filter((f) => f.key !== action.key),
      }
    case "LOAD_DRAFT":
      return { ...state, ...action.state, isDraft: true }
    case "RESET":
      return createInitialFormState(state.listingId)
    default:
      return state
  }
}

// ============================================================
// Hook
// ============================================================

export interface UseApplicationFormReturn {
  state: ApplicationFormState
  dispatch: React.Dispatch<FormAction>
  // Navigation
  goToStep: (step: ApplicationStep) => void
  nextStep: () => void
  previousStep: () => void
  canGoNext: boolean
  canGoPrevious: boolean
  // Data updates
  setApplicant: (data: Partial<ApplicantFormData>) => void
  setAlternateContact: (data: Partial<AlternateContactFormData>) => void
  setHouseholdMembers: (members: HouseholdMemberFormData[]) => void
  addHouseholdMember: (member: HouseholdMemberFormData) => void
  removeHouseholdMember: (index: number) => void
  setPreferences: (preferences: PreferenceFormData[]) => void
  setIncome: (data: Partial<IncomeFormData>) => void
  addUploadedFile: (file: UploadedFileRef) => void
  removeUploadedFile: (key: string) => void
  // Draft
  loadDraft: (draftData: Partial<ApplicationFormState>) => void
  setApplicationId: (id: string) => void
}

export function useApplicationForm(listingId: string): UseApplicationFormReturn {
  const [state, dispatch] = useReducer(formReducer, createInitialFormState(listingId))

  const currentStepIndex = APPLICATION_STEPS.indexOf(state.currentStep)
  const canGoNext = currentStepIndex < APPLICATION_STEPS.length - 1
  const canGoPrevious = currentStepIndex > 0

  const goToStep = useCallback((step: ApplicationStep) => {
    dispatch({ type: "SET_STEP", step })
  }, [])

  const nextStep = useCallback(() => {
    if (canGoNext) {
      dispatch({ type: "SET_STEP", step: APPLICATION_STEPS[currentStepIndex + 1] })
    }
  }, [canGoNext, currentStepIndex])

  const previousStep = useCallback(() => {
    if (canGoPrevious) {
      dispatch({ type: "SET_STEP", step: APPLICATION_STEPS[currentStepIndex - 1] })
    }
  }, [canGoPrevious, currentStepIndex])

  const setApplicant = useCallback((data: Partial<ApplicantFormData>) => {
    dispatch({ type: "SET_APPLICANT", data })
  }, [])

  const setAlternateContact = useCallback((data: Partial<AlternateContactFormData>) => {
    dispatch({ type: "SET_ALTERNATE_CONTACT", data })
  }, [])

  const setHouseholdMembers = useCallback((members: HouseholdMemberFormData[]) => {
    dispatch({ type: "SET_HOUSEHOLD_MEMBERS", members })
  }, [])

  const addHouseholdMember = useCallback((member: HouseholdMemberFormData) => {
    dispatch({ type: "ADD_HOUSEHOLD_MEMBER", member })
  }, [])

  const removeHouseholdMember = useCallback((index: number) => {
    dispatch({ type: "REMOVE_HOUSEHOLD_MEMBER", index })
  }, [])

  const setPreferences = useCallback((preferences: PreferenceFormData[]) => {
    dispatch({ type: "SET_PREFERENCES", preferences })
  }, [])

  const setIncome = useCallback((data: Partial<IncomeFormData>) => {
    dispatch({ type: "SET_INCOME", data })
  }, [])

  const addUploadedFile = useCallback((file: UploadedFileRef) => {
    dispatch({ type: "ADD_UPLOADED_FILE", file })
  }, [])

  const removeUploadedFile = useCallback((key: string) => {
    dispatch({ type: "REMOVE_UPLOADED_FILE", key })
  }, [])

  const loadDraft = useCallback((draftData: Partial<ApplicationFormState>) => {
    dispatch({ type: "LOAD_DRAFT", state: draftData })
  }, [])

  const setApplicationId = useCallback((id: string) => {
    dispatch({ type: "SET_APPLICATION_ID", id })
  }, [])

  return {
    state,
    dispatch,
    goToStep,
    nextStep,
    previousStep,
    canGoNext,
    canGoPrevious,
    setApplicant,
    setAlternateContact,
    setHouseholdMembers,
    addHouseholdMember,
    removeHouseholdMember,
    setPreferences,
    setIncome,
    addUploadedFile,
    removeUploadedFile,
    loadDraft,
    setApplicationId,
  }
}
