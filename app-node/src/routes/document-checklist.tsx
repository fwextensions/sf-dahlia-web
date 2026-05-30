/**
 * Document Checklist page route: /document-checklist
 */
import { createFileRoute } from "@tanstack/react-router"
import { DocumentChecklist } from "../pages/DocumentChecklist"
import { loadPageTranslations } from "../lib/routing/createPageLoader"

export const Route = createFileRoute("/document-checklist")({
  loader: () => loadPageTranslations(),
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
