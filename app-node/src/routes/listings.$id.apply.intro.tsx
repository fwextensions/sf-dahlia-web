import { createFileRoute } from "@tanstack/react-router"
import { ListingApplyForm } from "~/pages/apply/ListingApplyForm"

export const Route = createFileRoute("/listings/$id/apply/intro")({
  component: ListingApplyIntro,
})

function ListingApplyIntro() {
  const { id } = Route.useParams()
  return <ListingApplyForm listingId={id} />
}
