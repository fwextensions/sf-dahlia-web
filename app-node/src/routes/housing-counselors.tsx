import { createFileRoute } from "@tanstack/react-router"
import { HousingCounselors } from "~/pages/assistance/HousingCounselors"

export const Route = createFileRoute("/housing-counselors")({
  component: HousingCounselors,
  staticData: { nativeShell: true },
})
