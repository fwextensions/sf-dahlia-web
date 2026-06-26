/**
 * Shared route config for the native next-steps (invite-to) pages.
 *
 * Each page is served at both the unprefixed and `/$lang` paths; both render the
 * same native component with the same loader, so the search schema and loader
 * live here to keep the route files from drifting (mirrors lib/listings/route-config).
 *
 * The Rails InviteToController accepts the invite params either as query params
 * (type/deadline/act/appId/isTest) or packed into a signed JWT `t` token (the
 * links DAHLIA emails use). We decode the token's payload here so the component
 * can dispatch the same way for both entry paths.
 */
import { getInviteToApplicationUrls } from "./server-fns"
import { getListingDetail, type SerializableListing } from "../listings/server-fns"

export interface InviteToSearch {
  type?: string
  deadline?: string
  act?: string
  appId?: string
  isTest?: boolean
  force?: true
}

/**
 * Decode the JWT `t` token's payload WITHOUT verifying its signature.
 *
 * app-node has neither the JWT signing secret nor a JWT library, so it can't
 * verify like Rails does — it only reads the embedded params to render the page.
 * That's acceptable here because app-node performs no security-sensitive action
 * from the token (response recording is a separate, guarded client call); a
 * forged token can at most render a different invite-to view. Returns {} if the
 * token is missing or malformed.
 */
function decodeTokenPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1]
    if (!payload) return {}
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const json =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf8")
    const decoded = JSON.parse(json) as { data?: Record<string, unknown> }
    return decoded.data ?? {}
  } catch {
    return {}
  }
}

export function inviteToSearchSchema(
  search: Record<string, unknown>
): InviteToSearch {
  // Token params (if present) are the source of truth, mirroring Rails'
  // `decoded_params ||= params`.
  const fromToken =
    typeof search.t === "string" ? decodeTokenPayload(search.t) : {}
  const pick = (key: string): string | undefined => {
    const v = fromToken[key] ?? search[key]
    return typeof v === "string" && v.length > 0 ? v : undefined
  }
  const isTestRaw = fromToken.isTest ?? search.isTest
  const result: InviteToSearch = {}
  const type = pick("type")
  const deadline = pick("deadline")
  // Rails accepts the deprecated `response` alias for `act`.
  const act = pick("act") ?? pick("response")
  const appId = pick("appId") ?? pick("applicationNumber")
  if (type) result.type = type
  if (deadline) result.deadline = deadline
  if (act) result.act = act
  if (appId) result.appId = appId
  if (isTestRaw === true || isTestRaw === "true") result.isTest = true
  if (search.force === "true" || search.force === true) result.force = true
  return result
}

export const inviteToLoaderDeps = ({
  search,
}: {
  search: InviteToSearch
}): { appId?: string; force?: true } => ({
  appId: search.appId,
  force: search.force,
})

export interface NextStepsLoaderData {
  listing: SerializableListing
  uploadUrl: string | null
  schedulingUrl: string | null
}

export async function loadNextSteps(
  id: string,
  deps: { appId?: string; force?: true }
): Promise<NextStepsLoaderData> {
  const listing = await getListingDetail({ data: { id, force: deps.force } })
  let uploadUrl: string | null = null
  let schedulingUrl: string | null = null
  if (deps.appId) {
    const urls = await getInviteToApplicationUrls({ data: { id: deps.appId } })
    uploadUrl = urls.uploadUrl
    schedulingUrl = urls.schedulingUrl
  }
  return { listing, uploadUrl, schedulingUrl }
}
