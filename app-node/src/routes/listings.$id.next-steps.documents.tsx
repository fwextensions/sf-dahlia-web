/**
 * Native next-steps documents route (I2A/I2I document checklist). SSR via the
 * shared invite-to loader; component in src/pages/inviteTo/NextStepsDocuments.
 */
import { createFileRoute } from "@tanstack/react-router"
import { NextStepsDocuments } from "../pages/inviteTo/NextStepsDocuments"
import { ErrorPage } from "../components/ErrorPage"
import {
  inviteToSearchSchema,
  inviteToLoaderDeps,
  loadNextSteps,
} from "../lib/inviteTo/route-config"

export const Route = createFileRoute("/listings/$id/next-steps/documents")({
  validateSearch: inviteToSearchSchema,
  loaderDeps: inviteToLoaderDeps,
  loader: ({ params, deps }) => loadNextSteps(params.id, deps),
  component: NextStepsDocumentsRoute,
  errorComponent: NextStepsDocumentsError,
  staticData: { nativeShell: true },
})

function NextStepsDocumentsRoute() {
  const { listing } = Route.useLoaderData()
  const search = Route.useSearch()
  return <NextStepsDocuments listing={listing} search={search} />
}

function NextStepsDocumentsError() {
  return (
    <ErrorPage
      title="Unable to Load Documents"
      message="We're having trouble loading the document checklist for this listing. Please try again in a moment."
    />
  )
}
