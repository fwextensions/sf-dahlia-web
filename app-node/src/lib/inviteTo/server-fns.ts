/**
 * Server function for the invite-to (next-steps) flow.
 *
 * The Rails InviteToController merges `uploadURL` / `leaseupAppointmentSchedulingURL`
 * from the applicant's Salesforce application (Force::ShortFormService.get) into the
 * page props. This fetches the same two URLs server-side via the Salesforce proxy so
 * the native next-steps page can supply the I2A file-upload and I2I scheduling links.
 *
 * Best-effort: returns nulls on any failure (the page falls back to
 * listing.File_Upload_URL for I2A; the I2I scheduling button is gated on a flag).
 */
import { createServerFn } from "@tanstack/react-start"

export interface InviteToUrls {
  uploadUrl: string | null
  schedulingUrl: string | null
}

export const getInviteToApplicationUrls = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<InviteToUrls> => {
    try {
      const { createSalesforceProxyClient } = await import("../salesforce/client")
      const client = createSalesforceProxyClient()
      // The proxy returns the raw Salesforce application shape; uploadURL /
      // leaseupAppointmentSchedulingURL aren't in the typed subset, so read loosely.
      const app = (await client.shortForm.getApplication(data.id)) as Record<
        string,
        unknown
      >
      return {
        uploadUrl: (app.uploadURL as string) ?? null,
        schedulingUrl: (app.leaseupAppointmentSchedulingURL as string) ?? null,
      }
    } catch (err) {
      console.error("[getInviteToApplicationUrls] failed:", err)
      return { uploadUrl: null, schedulingUrl: null }
    }
  })
