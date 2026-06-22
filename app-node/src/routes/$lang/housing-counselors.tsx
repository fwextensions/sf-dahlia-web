import { createFileRoute } from "@tanstack/react-router"
import { HousingCounselors } from "~/pages/assistance/HousingCounselors"

export const Route = createFileRoute("/$lang/housing-counselors")({
  component: HousingCounselors,
  staticData: { nativeShell: true },
})
