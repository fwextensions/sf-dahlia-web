/**
 * Bridges to the original Rails react-on-rails page component in
 * app/javascript. The page is mounted client-side after translations load
 * (see src/components/RailsPage.tsx), matching how the Rails app renders it.
 */
import { createFileRoute } from "@tanstack/react-router"
import { RailsPage } from "../../components/RailsPage"

const load = () => import("../../../../app/javascript/pages/listings/listing-detail")

export const Route = createFileRoute("/$lang/listings/$id")({
  ssr: false,
  component: PageRoute,
})

function PageRoute() {
  return <RailsPage load={load} />
}
