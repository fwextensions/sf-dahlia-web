/**
 * Native next-steps (invite-to) route. SSR via a server loader; dispatches the
 * I2A/I2I views in src/pages/inviteTo/NextSteps. See lib/inviteTo/route-config
 * for the shared search schema + loader (kept in sync with the /$lang variant).
 */
import { createFileRoute } from "@tanstack/react-router"
import { NextSteps } from "../pages/inviteTo/NextSteps"
import { ErrorPage } from "../components/ErrorPage"
import {
  inviteToSearchSchema,
  inviteToLoaderDeps,
  loadNextSteps,
} from "../lib/inviteTo/route-config"

export const Route = createFileRoute("/listings/$id/next-steps")({
  validateSearch: inviteToSearchSchema,
  loaderDeps: inviteToLoaderDeps,
  loader: ({ params, deps }) => loadNextSteps(params.id, deps),
  component: NextStepsRoute,
  errorComponent: NextStepsError,
  staticData: { nativeShell: true },
})

function NextStepsRoute() {
  const { listing, uploadUrl, schedulingUrl } = Route.useLoaderData()
  const search = Route.useSearch()
  return (
    <NextSteps
      listing={listing}
      uploadUrl={uploadUrl}
      schedulingUrl={schedulingUrl}
      search={search}
    />
  )
}

function NextStepsError() {
  return (
    <ErrorPage
      title="Unable to Load Next Steps"
      message="We're having trouble loading the next steps for this listing. Please try again in a moment."
    />
  )
}
