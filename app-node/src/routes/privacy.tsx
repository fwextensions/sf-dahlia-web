import { createFileRoute } from "@tanstack/react-router"
import { Privacy } from "~/pages/assistance/Privacy"

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  staticData: { nativeShell: true },
})
