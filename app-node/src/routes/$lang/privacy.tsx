import { createFileRoute } from "@tanstack/react-router"
import { Privacy } from "~/pages/assistance/Privacy"

export const Route = createFileRoute("/$lang/privacy")({
  component: Privacy,
  staticData: { nativeShell: true },
})
