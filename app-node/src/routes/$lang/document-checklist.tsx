/**
 * Language-prefixed Document Checklist page route: /:lang/document-checklist
 */
import { createFileRoute } from "@tanstack/react-router"
import { DocumentChecklist } from "../../pages/DocumentChecklist"
import { loadPageTranslations } from "../../lib/routing/createPageLoader"

export const Route = createFileRoute("/$lang/document-checklist")({
  loader: ({ params }) => loadPageTranslations(params.lang),
  component: DocumentChecklistRoute,
})

function DocumentChecklistRoute() {
  const { translations, fallbackTranslations } = Route.useLoaderData()
  return (
    <DocumentChecklist
      translations={translations}
      fallbackTranslations={fallbackTranslations}
    />
  )
}
