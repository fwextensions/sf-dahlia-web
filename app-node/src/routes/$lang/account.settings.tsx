import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { updateProfile } from "~/lib/account/server-fns"
import type { UpdateProfileInput } from "~/lib/account/server-fns"

export const Route = createFileRoute("/$lang/account/settings")({
  component: AccountSettingsPage,
})

function AccountSettingsPage() {
  const router = useRouter()

  const [formData, setFormData] = useState<UpdateProfileInput>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage("")
    setErrorMessage("")
    setIsSubmitting(true)

    try {
      const filtered = Object.fromEntries(
        Object.entries(formData).filter(([, v]) => v && v.trim() !== "")
      ) as UpdateProfileInput

      await updateProfile({ data: filtered })
      setSuccessMessage("Profile updated successfully.")
      router.invalidate()
    } catch {
      setErrorMessage("Failed to update profile. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Account Settings</h1>

      {successMessage && (
        <p role="status" aria-live="polite">
          {successMessage}
        </p>
      )}

      {errorMessage && <p role="alert">{errorMessage}</p>}

      <form onSubmit={handleSubmit} aria-label="Update profile">
        <fieldset>
          <legend>Personal Information</legend>

          <label htmlFor="firstName">First Name</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            value={formData.firstName}
            onChange={handleChange}
          />

          <label htmlFor="lastName">Last Name</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={formData.lastName}
            onChange={handleChange}
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />

          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
          />
        </fieldset>

        <fieldset>
          <legend>Address</legend>

          <label htmlFor="address">Street Address</label>
          <input
            id="address"
            name="address"
            type="text"
            value={formData.address}
            onChange={handleChange}
          />

          <label htmlFor="city">City</label>
          <input
            id="city"
            name="city"
            type="text"
            value={formData.city}
            onChange={handleChange}
          />

          <label htmlFor="state">State</label>
          <input
            id="state"
            name="state"
            type="text"
            value={formData.state}
            onChange={handleChange}
          />

          <label htmlFor="zip">ZIP Code</label>
          <input
            id="zip"
            name="zip"
            type="text"
            value={formData.zip}
            onChange={handleChange}
          />
        </fieldset>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </main>
  )
}
