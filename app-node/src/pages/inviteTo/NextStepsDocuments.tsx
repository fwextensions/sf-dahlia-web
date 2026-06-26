/**
 * Native next-steps documents page. Ports the `documentsPath` branch of
 * app/javascript/pages/inviteTo/invite-to.tsx: renders the I2A or I2I document
 * checklist (chrome-free `*Content` exports) under AppShell, gated on the same
 * Unleash flags Rails uses.
 */
import { getFlag, FLAGS } from "../../lib/flags/store"
import { InviteToApplyDocumentsContent } from "../../../../app/javascript/pages/inviteTo/inviteToApply/InviteToApplyDocuments"
import { InviteToInterviewDocumentsContent } from "../../../../app/javascript/pages/inviteTo/inviteToInterview/InviteToInterviewDocuments"
import { INVITE_TO_X } from "../../../../app/javascript/modules/constants"
import type RailsSaleListing from "../../../../app/javascript/api/types/rails/listings/RailsSaleListing"
import type { SerializableListing } from "../../lib/listings/server-fns"
import heroBg from "../../../../app/assets/images/bg@1200.jpg"
import type { InviteToSearch } from "../../lib/inviteTo/route-config"

interface NextStepsDocumentsProps {
  // Loader carries the serializable subset; cast at the boundary (see NextSteps).
  listing: SerializableListing
  search: InviteToSearch
}

export function NextStepsDocuments({ listing: listingProp, search }: NextStepsDocumentsProps) {
  const listing = listingProp as unknown as RailsSaleListing
  if (search.type === INVITE_TO_X.INTERVIEW) {
    if (!(getFlag(FLAGS.I2I) && !!listing?.Id)) return null
    return <InviteToInterviewDocumentsContent listing={listing} backgroundImage={heroBg} />
  }
  if (!getFlag(FLAGS.INVITE_TO_APPLY)) return null
  return <InviteToApplyDocumentsContent listing={listing} backgroundImage={heroBg} />
}
