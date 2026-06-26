/**
 * Native next-steps (invite-to) page. Ports app/javascript/pages/inviteTo/
 * invite-to.tsx: dispatches across the I2A/I2I next-steps, withdrawn,
 * contact-me-later and deadline-passed views based on the invite params, gated
 * on the same Unleash flags Rails uses. Renders the chrome-free `*Content`
 * exports of the Rails components under AppShell.
 *
 * Response recording: the Rails InviteToController records the applicant's
 * yes/no/contact response server-side on page load. app-node has no equivalent
 * server hook, so we POST the same `/api/v1/next-steps/record-response` endpoint
 * from a client effect once on mount, applying the controller's guards (skip
 * when no action, the deadline has passed, or this is a test link). The Rails
 * language-change guard (referrer-based) is not replicated.
 */
import { useEffect, useRef } from "react"
import { getFlag, FLAGS } from "../../lib/flags/store"
import { getCurrentLanguage } from "../../../../app/javascript/util/languageUtil"
import { isDeadlinePassed } from "../../../../app/javascript/util/listingUtil"
import { InviteToApplyNextStepsContent } from "../../../../app/javascript/pages/inviteTo/inviteToApply/InviteToApplyNextSteps"
import { InviteToInterviewNextStepsContent } from "../../../../app/javascript/pages/inviteTo/inviteToInterview/InviteToInterviewNextSteps"
import { InviteToWithdrawnContent } from "../../../../app/javascript/pages/inviteTo/InviteToWithdrawn"
import { InviteToContactMeLaterContent } from "../../../../app/javascript/pages/inviteTo/InviteToContactMeLater"
import { InviteToDeadlinePassedContent } from "../../../../app/javascript/pages/inviteTo/InviteToDeadlinePassed"
import { INVITE_TO_X } from "../../../../app/javascript/modules/constants"
import type RailsSaleListing from "../../../../app/javascript/api/types/rails/listings/RailsSaleListing"
import type { SerializableListing } from "../../lib/listings/server-fns"
import heroBg from "../../../../app/assets/images/bg@1200.jpg"
import { FormSection } from "./FormSection"
import type { InviteToSearch } from "../../lib/inviteTo/route-config"

interface NextStepsProps {
  // The loader carries the serializable subset; the raw Salesforce fields the
  // Rails components read are present at runtime, so cast at the boundary.
  listing: SerializableListing
  uploadUrl: string | null
  schedulingUrl: string | null
  search: InviteToSearch
}

/** POST the invite-to response (mirrors the Rails controller's load-time record). */
function recordResponseOnce(record: {
  listingId: string
  appId: string
  deadline: string
  action: string
  type: string
}) {
  void fetch("/api/v1/next-steps/record-response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record: {
        ...record,
        applicationNumber: record.appId,
        response: record.action,
      },
    }),
  }).catch((err) => {
    console.error("[next-steps] record-response failed:", err)
  })
}

export function NextSteps({
  listing: listingProp,
  uploadUrl,
  schedulingUrl,
  search,
}: NextStepsProps) {
  const listing = listingProp as unknown as RailsSaleListing
  const { type, act, appId, deadline, isTest } = search
  const recorded = useRef(false)

  useEffect(() => {
    if (recorded.current) return
    if (!act || !appId || isTest) return
    if (deadline && isDeadlinePassed(deadline)) return
    recorded.current = true
    recordResponseOnce({
      listingId: listing.Id,
      appId,
      deadline: deadline ?? "",
      action: act,
      type: type ?? "",
    })
  }, [act, appId, isTest, deadline, type, listing.Id])

  const isI2AEnabled = getFlag(FLAGS.INVITE_TO_APPLY)
  const isI2IEnabled = getFlag(FLAGS.I2I) && !!listing?.Id

  // Mirrors generateSubmitLink's no-token branch (a plain query-string link back
  // to next-steps, without the act); app-node can't re-sign the JWT token.
  const submitPreviewLink = `/${getCurrentLanguage()}/listings/${listing.Id}/next-steps?${new URLSearchParams(
    { appId: appId ?? "", deadline: deadline ?? "", type: type ?? "" }
  ).toString()}`

  // Pass deadline through as-is (possibly undefined), matching the Rails flow:
  // isDeadlinePassed/dayjs tolerate undefined (treated as now) but throw on an
  // empty string, so do NOT coerce a missing deadline to "".
  const deadlineStr = deadline as string

  if (type === INVITE_TO_X.INTERVIEW) {
    if (!isI2IEnabled) return null
    if (!act || act === "yes") {
      return (
        <InviteToInterviewNextStepsContent
          listing={listing}
          deadline={deadlineStr}
          url={schedulingUrl ?? ""}
          backgroundImage={heroBg}
        />
      )
    }
    if (act === "no") {
      return (
        <FormSection>
          <InviteToWithdrawnContent
            type={INVITE_TO_X.INTERVIEW}
            listing={listing}
            deadline={deadlineStr}
            submitPreviewLink={submitPreviewLink}
          />
        </FormSection>
      )
    }
    if (isDeadlinePassed(deadlineStr)) {
      return (
        <FormSection>
          <InviteToDeadlinePassedContent listing={listing} />
        </FormSection>
      )
    }
    if (act === "contact") {
      return (
        <FormSection>
          <InviteToContactMeLaterContent
            type={INVITE_TO_X.INTERVIEW}
            listing={listing}
            deadline={deadlineStr}
            submitPreviewLink={submitPreviewLink}
          />
        </FormSection>
      )
    }
    return null
  }

  // I2A (Invite to Apply)
  if (!isI2AEnabled) return null
  if (!act || act === "yes") {
    return (
      <InviteToApplyNextStepsContent
        listing={listing}
        deadline={deadlineStr}
        appId={appId}
        fileUploadUrl={uploadUrl ?? undefined}
        isTest={isTest}
        backgroundImage={heroBg}
      />
    )
  }
  if (act === "no") {
    return (
      <FormSection>
        <InviteToWithdrawnContent
          type={INVITE_TO_X.APPLY}
          listing={listing}
          deadline={deadlineStr}
          submitPreviewLink={submitPreviewLink}
        />
      </FormSection>
    )
  }
  if (isDeadlinePassed(deadlineStr)) {
    return (
      <FormSection>
        <InviteToDeadlinePassedContent listing={listing} />
      </FormSection>
    )
  }
  if (act === "contact") {
    return (
      <FormSection>
        <InviteToContactMeLaterContent
          type={INVITE_TO_X.APPLY}
          listing={listing}
          deadline={deadlineStr}
          submitPreviewLink={submitPreviewLink}
        />
      </FormSection>
    )
  }
  return null
}
