/**
 * Step: You - Primary applicant and alternate contact information.
 * Integrates EasyPost address validation.
 */

import { useState } from "react"
import type {
  ApplicantFormData,
  AlternateContactFormData,
} from "../../../lib/apply/types"
import type { AddressValidationResult } from "../../../lib/address"

interface StepYouProps {
  applicant: ApplicantFormData
  alternateContact: AlternateContactFormData
  onApplicantChange: (data: Partial<ApplicantFormData>) => void
  onAlternateContactChange: (data: Partial<AlternateContactFormData>) => void
  onValidateAddress: (address: {
    street1: string
    street2?: string
    city: string
    state: string
    zip: string
  }) => Promise<AddressValidationResult>
  onNext: () => void
  onPrevious: () => void
}

export function StepYou({
  applicant,
  alternateContact,
  onApplicantChange,
  onAlternateContactChange,
  onValidateAddress,
  onNext,
  onPrevious,
}: StepYouProps) {
  const [addressErrors, setAddressErrors] = useState<string[]>([])
  const [validatingAddress, setValidatingAddress] = useState(false)

  const handleAddressValidation = async () => {
    if (!applicant.address.street1 || !applicant.address.city) return

    setValidatingAddress(true)
    setAddressErrors([])

    const result = await onValidateAddress({
      street1: applicant.address.street1,
      street2: applicant.address.street2 || undefined,
      city: applicant.address.city,
      state: applicant.address.state,
      zip: applicant.address.zip,
    })

    if (!result.success) {
      setAddressErrors(result.errors)
    } else if (result.address) {
      // Update with validated/standardized address
      onApplicantChange({
        address: {
          street1: result.address.street1,
          street2: result.address.street2 ?? "",
          city: result.address.city,
          state: result.address.state,
          zip: result.address.zip,
        },
      })
    }

    setValidatingAddress(false)
  }

  return (
    <section aria-labelledby="step-you-heading">
      <h2 id="step-you-heading">About You</h2>

      <fieldset>
        <legend>Primary Applicant</legend>

        <label htmlFor="firstName">First Name *</label>
        <input
          id="firstName"
          type="text"
          required
          value={applicant.firstName}
          onChange={(e) => onApplicantChange({ firstName: e.target.value })}
        />

        <label htmlFor="lastName">Last Name *</label>
        <input
          id="lastName"
          type="text"
          required
          value={applicant.lastName}
          onChange={(e) => onApplicantChange({ lastName: e.target.value })}
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={applicant.email}
          onChange={(e) => onApplicantChange({ email: e.target.value })}
        />

        <label htmlFor="dob">Date of Birth</label>
        <input
          id="dob"
          type="date"
          value={applicant.DOB}
          onChange={(e) => onApplicantChange({ DOB: e.target.value })}
        />

        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          type="tel"
          value={applicant.phone}
          onChange={(e) => onApplicantChange({ phone: e.target.value })}
        />
      </fieldset>

      <fieldset>
        <legend>Home Address</legend>

        <label htmlFor="street1">Street Address *</label>
        <input
          id="street1"
          type="text"
          required
          value={applicant.address.street1}
          onChange={(e) =>
            onApplicantChange({
              address: { ...applicant.address, street1: e.target.value },
            })
          }
        />

        <label htmlFor="street2">Street Address 2</label>
        <input
          id="street2"
          type="text"
          value={applicant.address.street2}
          onChange={(e) =>
            onApplicantChange({
              address: { ...applicant.address, street2: e.target.value },
            })
          }
        />

        <label htmlFor="city">City *</label>
        <input
          id="city"
          type="text"
          required
          value={applicant.address.city}
          onChange={(e) =>
            onApplicantChange({
              address: { ...applicant.address, city: e.target.value },
            })
          }
        />

        <label htmlFor="state">State *</label>
        <input
          id="state"
          type="text"
          required
          value={applicant.address.state}
          onChange={(e) =>
            onApplicantChange({
              address: { ...applicant.address, state: e.target.value },
            })
          }
        />

        <label htmlFor="zip">ZIP Code *</label>
        <input
          id="zip"
          type="text"
          required
          value={applicant.address.zip}
          onChange={(e) =>
            onApplicantChange({
              address: { ...applicant.address, zip: e.target.value },
            })
          }
        />

        <button
          type="button"
          onClick={handleAddressValidation}
          disabled={validatingAddress}
          aria-busy={validatingAddress}
        >
          {validatingAddress ? "Validating..." : "Verify Address"}
        </button>

        {addressErrors.length > 0 && (
          <div role="alert">
            <ul>
              {addressErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Alternate Contact</legend>

        <label htmlFor="altFirstName">First Name</label>
        <input
          id="altFirstName"
          type="text"
          value={alternateContact.firstName}
          onChange={(e) => onAlternateContactChange({ firstName: e.target.value })}
        />

        <label htmlFor="altLastName">Last Name</label>
        <input
          id="altLastName"
          type="text"
          value={alternateContact.lastName}
          onChange={(e) => onAlternateContactChange({ lastName: e.target.value })}
        />

        <label htmlFor="altEmail">Email</label>
        <input
          id="altEmail"
          type="email"
          value={alternateContact.email}
          onChange={(e) => onAlternateContactChange({ email: e.target.value })}
        />

        <label htmlFor="altPhone">Phone</label>
        <input
          id="altPhone"
          type="tel"
          value={alternateContact.phone}
          onChange={(e) => onAlternateContactChange({ phone: e.target.value })}
        />
      </fieldset>

      <div>
        <button type="button" onClick={onPrevious}>Previous</button>
        <button type="button" onClick={onNext}>Next</button>
      </div>
    </section>
  )
}
