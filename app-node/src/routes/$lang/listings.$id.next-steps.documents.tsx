import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/$lang/listings/$id/next-steps/documents"
)({
  component: NextStepsDocuments,
})

function NextStepsDocuments() {
  const { id } = Route.useParams()
  return (
    <main>
      <h1>Next Steps Documents: {id}</h1>
    </main>
  )
}
