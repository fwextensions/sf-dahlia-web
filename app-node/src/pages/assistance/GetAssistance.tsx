/**
 * Native get-assistance page (SSR). Ports
 * app/javascript/pages/getAssistance/get-assistance.tsx. routeUtil path getters
 * are replaced with getLocalizedPath (routeUtil reads window at module eval).
 */
import { ActionBlock, Icon, t, Heading } from "@uic"
import {
  faClipboardList,
  faHouseChimney,
  faDoorOpen,
  faPeopleGroup,
} from "@fortawesome/free-solid-svg-icons"
import { faYoutube } from "@fortawesome/free-brands-svg-icons"
import { HeaderSidebarLayout } from "../../components/HeaderSidebarLayout"
import ContactSideBarBlock from "../../../../app/javascript/layouts/Sidebar/ContactSidebarBlock"
import { getLocalizedPath } from "../../lib/i18n/localized-path"

export function GetAssistance() {
  return (
    <HeaderSidebarLayout
      title={t("assistance.title.getAssistance")}
      subtitle={t("assistance.subtitle.getAssistance")}
      mainPage
      sidebarContent={<ContactSideBarBlock />}
    >
      <ActionBlock
        header={<Heading priority={2}>{t("assistance.title.housingCouneslors")}</Heading>}
        subheader={t("assistance.subtitle.housingCouneslors")}
        background="none"
        icon={<Icon size="2xl" symbol={faPeopleGroup} fill={"var(--bloom-color-gray-750)"} />}
        actions={[
          <a key="housing-counselors" className="button" href={getLocalizedPath("/housing-counselors")}>
            {t("housingCounselor.findAHousingCounselor")}
          </a>,
        ]}
      />
      <ActionBlock
        header={
          <Heading priority={2}>{t("assistance.title.additionalHousingOpportunities")}</Heading>
        }
        subheader={t("assistance.subtitle.additionalHousingOpportunities")}
        background="primary-lighter"
        icon={<Icon size="2xl" symbol={faHouseChimney} fill={"var(--bloom-color-gray-750)"} />}
        actions={[
          <a
            key="additional-resources"
            className="button w-3/4 md:w-auto"
            href={getLocalizedPath("/additional-resources")}
          >
            {t("assistance.title.additionalHousingOpportunities.button")}
          </a>,
        ]}
      />
      <ActionBlock
        header={<Heading priority={2}>{t("assistance.title.sfServices")}</Heading>}
        subheader={t("assistance.subtitle.sfServices")}
        background="none"
        icon={<Icon size="2xl" symbol={faDoorOpen} fill={"var(--bloom-color-gray-750)"} />}
        actions={[
          <a
            key="sf-services"
            className="button"
            href={"https://sfserviceguide.org/"}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("assistance.title.sfServices.button")}
          </a>,
        ]}
      />
      <ActionBlock
        header={<Heading priority={2}>{t("assistance.title.documentChecklist")}</Heading>}
        subheader={t("assistance.subtitle.documentChecklist")}
        background="primary-lighter"
        icon={<Icon size="2xl" symbol={faClipboardList} fill={"var(--bloom-color-gray-750)"} />}
        actions={[
          <a
            key="document-checklist"
            className="button"
            href={getLocalizedPath("/document-checklist")}
          >
            {t("label.viewDocumentChecklist")}
          </a>,
        ]}
      />
      <ActionBlock
        header={<Heading priority={2}>{t("assistance.title.dahliaVideos")}</Heading>}
        subheader={t("assistance.subtitle.dahliaVideos")}
        background="none"
        icon={<Icon size="2xl" symbol={faYoutube} fill={"var(--bloom-color-gray-750)"} />}
        actions={[
          <a
            key="dahlia-videos"
            className="button"
            href={"https://www.youtube.com/playlist?list=PL7dcWHJTcA51TBqhghJ9LfSGEGoFB7aWG"}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("assistance.title.dahliaVideos.button")}
          </a>,
        ]}
      />
    </HeaderSidebarLayout>
  )
}
