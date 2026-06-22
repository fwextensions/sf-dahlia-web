import { createFileRoute } from "@tanstack/react-router"
import { DocumentChecklist } from "~/pages/assistance/DocumentChecklist"

export const Route = createFileRoute("/document-checklist")({
  component: DocumentChecklist,
  staticData: { nativeShell: true },
})
