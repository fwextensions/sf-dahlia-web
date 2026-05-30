import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/$lang/listings/$id/apply/intro")({
  component: ListingApplyIntro,
})

function ListingApplyIntro() {
  const { id } = Route.useParams()
  return (
    <main>
      <h1>Apply: {id}</h1>
    </main>
  )
}
