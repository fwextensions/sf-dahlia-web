import { createFileRoute } from "@tanstack/react-router"
import { GetAssistance } from "~/pages/assistance/GetAssistance"

export const Route = createFileRoute("/get-assistance")({
  component: GetAssistance,
  staticData: { nativeShell: true },
})
