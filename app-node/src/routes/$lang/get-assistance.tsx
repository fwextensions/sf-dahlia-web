import { createFileRoute } from "@tanstack/react-router"
import { GetAssistance } from "~/pages/assistance/GetAssistance"

export const Route = createFileRoute("/$lang/get-assistance")({
  component: GetAssistance,
  staticData: { nativeShell: true },
})
