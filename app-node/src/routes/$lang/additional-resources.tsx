import { createFileRoute } from "@tanstack/react-router"
import { AdditionalResources } from "~/pages/assistance/AdditionalResources"

export const Route = createFileRoute("/$lang/additional-resources")({
  component: AdditionalResources,
  staticData: { nativeShell: true },
})
