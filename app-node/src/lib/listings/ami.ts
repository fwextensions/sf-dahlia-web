/**
 * AMI chart helpers for the native listing-detail route.
 *
 * Inlined from app/javascript/util/listingUtil.getAmiChartDataFromUnits. The
 * units returned by the proxy carry the raw Salesforce fields (AMI_chart_type,
 * AMI_chart_year, Max/Min_AMI_for_Qualifying_Unit) via SerializableUnit's index
 * signature; we read them defensively here so the loader can fetch every chart
 * the units reference in a single getListingAmiCharts call.
 */
import type { SerializableUnit } from "./server-fns"
import type { AmiChartMetaInput } from "./server-fns"

/** Raw Salesforce AMI fields present on a unit (via the index signature). */
interface UnitAmiFields {
  AMI_chart_type?: string
  AMI_chart_year?: number
  Max_AMI_for_Qualifying_Unit?: number
  Min_AMI_for_Qualifying_Unit?: number
}

/**
 * Collect the unique (type, year, percent) AMI charts a listing's units need,
 * tagging each with whether it was derived from the unit's max or min AMI.
 * Mirrors listingUtil.getAmiChartDataFromUnits exactly.
 */
export function getAmiChartMetaDataFromUnits(
  units: SerializableUnit[]
): AmiChartMetaInput[] {
  const uniqueCharts: AmiChartMetaInput[] = []

  units?.forEach((unit) => {
    const { AMI_chart_type, AMI_chart_year, Max_AMI_for_Qualifying_Unit, Min_AMI_for_Qualifying_Unit } =
      unit as unknown as UnitAmiFields

    if (AMI_chart_type === undefined || AMI_chart_year === undefined) return

    const hasMatch = (percent: number) =>
      uniqueCharts.some(
        (c) => c.year === AMI_chart_year && c.type === AMI_chart_type && c.percent === percent
      )

    if (Max_AMI_for_Qualifying_Unit && !hasMatch(Max_AMI_for_Qualifying_Unit)) {
      uniqueCharts.push({
        year: AMI_chart_year,
        type: AMI_chart_type,
        percent: Max_AMI_for_Qualifying_Unit,
        derivedFrom: "MaxAmi",
      })
    }

    if (Min_AMI_for_Qualifying_Unit && !hasMatch(Min_AMI_for_Qualifying_Unit)) {
      uniqueCharts.push({
        year: AMI_chart_year,
        type: AMI_chart_type,
        percent: Min_AMI_for_Qualifying_Unit,
        derivedFrom: "MinAmi",
      })
    }
  })

  return uniqueCharts
}
