/**
 * Client for sf-dahlia-backend's messaging service.
 *
 * Mirrors Rails' DahliaBackend::ApiClient / DahliaBackend::MessageService:
 * a direct POST to the backend (not proxied through Rails), authenticated
 * with an API key header. Failures are logged and swallowed so a messaging
 * outage never fails the application submission itself.
 */
import { env } from "../../config/env"

const REQUEST_TIMEOUT_MS = 5_000

export interface LeasingAgentInfo {
  name: string
  email: string
  phone: string
  officeHours: string
}

export interface ApplicationConfirmationInput {
  email: string
  listingId: string
  listingName: string
  lotteryNumber: string
  lotteryDate: string
  isRental: boolean
  leasingAgent: LeasingAgentInfo
  lang: string
}

/**
 * Sends the application confirmation email via sf-dahlia-backend's
 * `POST /messages/application-submission`.
 */
export async function sendApplicationConfirmation(
  input: ApplicationConfirmationInput
): Promise<void> {
  if (!env.DAHLIA_API_URL) {
    console.warn(
      "[messages] DAHLIA_API_URL not configured; skipping application confirmation email"
    )
    return
  }

  try {
    const response = await fetch(
      `${env.DAHLIA_API_URL}/messages/application-submission`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.DAHLIA_API_KEY,
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    )

    if (!response.ok) {
      console.error(
        `[messages] Application confirmation request failed: ${response.status} ${await response.text().catch(() => "")}`
      )
    }
  } catch (error) {
    console.error("[messages] Error sending application confirmation:", error)
  }
}
