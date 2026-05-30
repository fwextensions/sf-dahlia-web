/**
 * Step: Intro - Welcome and instructions before starting the application.
 */

interface StepIntroProps {
  listingId: string
  onNext: () => void
}

export function StepIntro({ listingId, onNext }: StepIntroProps) {
  return (
    <section aria-labelledby="step-intro-heading">
      <h2 id="step-intro-heading">Welcome</h2>
      <p>
        You are about to start an application for listing {listingId}.
        Please have the following ready:
      </p>
      <ul>
        <li>Personal information (name, date of birth, contact info)</li>
        <li>Household member details</li>
        <li>Income documentation</li>
        <li>Proof documents for any preferences you qualify for</li>
      </ul>
      <p>
        Your progress will be saved as a draft. You can return to complete your
        application at any time.
      </p>
      <button type="button" onClick={onNext}>
        Start Application
      </button>
    </section>
  )
}
