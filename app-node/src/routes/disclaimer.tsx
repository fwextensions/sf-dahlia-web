import { createFileRoute } from "@tanstack/react-router"
import { Disclaimer } from "~/pages/assistance/Disclaimer"

export const Route = createFileRoute("/disclaimer")({
  component: Disclaimer,
  staticData: { nativeShell: true },
})
