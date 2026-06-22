/**
 * Native additional-resources page (SSR). Ports
 * app/javascript/pages/getAssistance/additional-resources.tsx.
 */
import { InfoCard, InfoCardGrid, t } from "@uic"
import additionalResources from "../../../../app/assets/json/additional-resources.json"
import { getSfGovUrl } from "../../../../app/javascript/util/languageUtil"
import { HeaderSidebarLayout } from "../../components/HeaderSidebarLayout"
import "../../../../app/javascript/pages/getAssistance/additional-resources.css"

export function AdditionalResources() {
  return (
    <HeaderSidebarLayout
      title={t("assistance.title.additionalHousingOpportunities")}
      subtitle={t("assistance.subtitle.additionalHousingOpportunities")}
    >
      <div className="flex flex-col ml-8 mr-8 mb-8 mt-8 lg:ml-0">
        {additionalResources.categories.map((category) => (
          <div
            className="info-card-grid-additional-resources mb-0 md:mb-8"
            key={category.title}
          >
            <InfoCardGrid
              title={t(category.title)}
              subtitle={t(category.subtitle)}
              defaultHeadingStyle
            >
              {category.resources.map((resource) => (
                <InfoCard
                  title={t(resource.title)}
                  subtitle={t(resource.agency)}
                  externalHref={getSfGovUrl(resource.externalUrl)}
                  className="info-card-additional-resources is-normal-primary-lighter"
                  key={resource.title}
                >
                  <div className="text-gray-950 text-xs">{t(resource.description)}</div>
                </InfoCard>
              ))}
            </InfoCardGrid>
          </div>
        ))}
      </div>
    </HeaderSidebarLayout>
  )
}
