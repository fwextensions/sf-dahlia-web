/**
 * Step: Review - Summary of all application data before submission.
 */

import type { ApplicationFormState } from "../../../lib/apply/types"

interface StepReviewProps {
  formState: ApplicationFormState
  onPrevious: () => void
  onSubmit: () => void
}

export function StepReview({ formState, onPrevious, onSubmit }: StepReviewProps) {
  const { applicant, alternateContact, householdMembers, preferences, income } = formState

  return (
    <section aria-labelledby="step-review-heading">
      <h2 id="step-review-heading">Review Your Application</h2>
      <p>Please review all information before submitting.</p>

      <h3>Primary Applicant</h3>
      <dl>
        <dt>Name</dt>
        <dd>{applicant.firstName} {applicant.lastName}</dd>
        <dt>Email</dt>
        <dd>{applicant.email || "Not provided"}</dd>
        <dt>Date of Birth</dt>
        <dd>{applicant.DOB || "Not provided"}</dd>
        <dt>Phone</dt>
        <dd>{applicant.phone || "Not provided"}</dd>
        <dt>Address</dt>
        <dd>
          {applicant.address.street1}
          {applicant.address.street2 && `, ${applicant.address.street2}`}
          {`, ${applicant.address.city}, ${applicant.address.state} ${applicant.address.zip}`}
        </dd>
      </dl>

      {alternateContact.firstName && (
        <>
          <h3>Alternate Contact</h3>
          <dl>
            <dt>Name</dt>
            <dd>{alternateContact.firstName} {alternateContact.lastName}</dd>
            <dt>Email</dt>
            <dd>{alternateContact.email || "Not provided"}</dd>
            <dt>Phone</dt>
            <dd>{alternateContact.phone || "Not provided"}</dd>
          </dl>
        </>
      )}

      <h3>Household Members</h3>
      {householdMembers.length === 0 ? (
        <p>No additional household members.</p>
      ) : (
        <ul>
          {householdMembers.map((m, i) => (
            <li key={i}>
              {m.firstName} {m.lastName}
              {m.relationship && ` (${m.relationship})`}
            </li>
          ))}
        </ul>
      )}

      <h3>Preferences</h3>
      {preferences.filter((p) => p.optedIn).length === 0 ? (
        <p>No preferences selected.</p>
      ) : (
        <ul>
          {preferences
            .filter((p) => p.optedIn)
            .map((p) => (
              <li key={p.preferenceId}>
                {p.preferenceName}
                {p.proofDocument && ` — Document: ${p.proofDocument.fileName}`}
              </li>
            ))}
        </ul>
      )}

      <h3>Income</h3>
      <p>
        {income.incomeTimeframe === "per_year" ? "Annual" : "Monthly"} income: $
        {income.incomeTotal.toLocaleString()}
      </p>

      <div>
        <button type="button" onClick={onPrevious}>Previous</button>
        <button type="button" onClick={onSubmit}>Submit Application</button>
      </div>
    </section>
  )
}
