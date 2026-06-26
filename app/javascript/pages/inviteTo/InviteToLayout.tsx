import React from "react"
import { Heading, Message } from "@bloom-housing/ui-seeds"
import { SidebarBlock, Icon, PageHeader, Desktop, t } from "@uic"
import RailsSaleListing from "../../api/types/rails/listings/RailsSaleListing"
import { getListingAddressString, isDeadlinePassed } from "../../util/listingUtil"
import {
  getTranslatedString,
  renderInlineMarkup,
  getCurrentLanguage,
  localizedFormat,
} from "../../util/languageUtil"
import styles from "./invite-to.module.css"
import InviteToLeasingAgentInfo from "./InviteToLeasingAgentInfo"
import Layout from "../../layouts/Layout"
import { INVITE_TO_X } from "../../modules/constants"

const InviteToHeader = ({
  listing,
  headerText,
}: {
  listing: RailsSaleListing
  headerText: string
}) => {
  return (
    <div className={styles.inviteToHeader}>
      <img
        src={listing?.Listing_Images?.[0]?.Image_URL}
        alt={listing?.Listing_Images?.[0]?.Image_Description}
      />
      <strong>{listing?.Building_Name_for_Process}</strong>
      <p>{listing && getListingAddressString(listing, false)}</p>
      <a href={`/${getCurrentLanguage()}/listings/${listing?.Id}`}>{t(headerText)}</a>
    </div>
  )
}

const DeadlineBanner = ({
  deadline,
  listing,
  type,
}: {
  deadline: string
  listing: RailsSaleListing
  type: INVITE_TO_X
}) => {
  if (type === INVITE_TO_X.APPLY) {
    return (
      <Message
        fullwidth
        variant={isDeadlinePassed(deadline) ? "alert" : "warn"}
        customIcon={<Icon symbol="clock" size="medium" />}
        className={styles.messageBanner}
      >
        <strong>
          {isDeadlinePassed(deadline)
            ? t("inviteToApplyPage.submitYourInfo.deadlinePassed")
            : t("inviteToApplyPage.submitYourInfo.submitByDeadline")}
        </strong>
        <span>
          {t("inviteToApplyPage.submitYourInfo.deadline", { day: localizedFormat(deadline, "ll") })}
        </span>
      </Message>
    )
  }

  return (
    <Message
      variant={isDeadlinePassed(deadline) ? "alert" : "warn"}
      fullwidth
      customIcon={<Icon symbol="clock" size="medium" />}
      testId={isDeadlinePassed(deadline) ? "deadline-passed-banner" : "deadline-not-passed-banner"}
      className={styles.messageBanner}
    >
      {isDeadlinePassed(deadline) ? (
        renderInlineMarkup(
          t("inviteToInterviewPage.submitYourInfo.deadlineInfo", {
            day: localizedFormat(deadline, "ll"),
            listingName: listing?.Building_Name_for_Process,
          })
        )
      ) : (
        <>
          <strong>{t("inviteToInterviewPage.submitYourInfo.scheduleByDeadline")}</strong>
          {t("inviteToInterviewPage.submitYourInfo.deadline", {
            day: localizedFormat(deadline, "ll"),
          })}
        </>
      )}
    </Message>
  )
}

const InviteToSidebarBlock = ({
  listing,
  sidebarText,
}: {
  listing: RailsSaleListing
  sidebarText: string
}) => {
  return (
    <SidebarBlock title={t("contactAgent.contact")} priority={3} className={styles.sidebarBlock}>
      <Heading size="lg" priority={3}>
        {t(sidebarText)}
      </Heading>
      <InviteToLeasingAgentInfo listing={listing} />
      <Heading size="sm" priority={3}>
        {t("contactAgent.officeHours.seeTheUnit")}
      </Heading>
      <p>{getTranslatedString(listing?.Office_Hours, "Office_Hours__c", listing?.translations)}</p>
    </SidebarBlock>
  )
}

interface InviteToLayoutInnerProps {
  listing: RailsSaleListing
  type: INVITE_TO_X
  title?: string
  subtitle?: string
  children: React.ReactNode
  /** Resolved hero background image URL (Rails: getAssetPath; app-node: Vite import). */
  backgroundImage: string
  sidebarText: string
  headerText: string
  deadline: string
}

/**
 * Layout body for the invite-to pages WITHOUT the site chrome (`<Layout>`). The
 * Rails default export below wraps this in `<Layout>`; the native app-node route
 * renders it directly under AppShell chrome. Takes a resolved `backgroundImage`
 * so it has no dependency on ConfigContext.getAssetPath (absent under app-node).
 */
export const InviteToLayoutInner = ({
  listing,
  type,
  title,
  subtitle,
  children,
  backgroundImage,
  sidebarText,
  headerText,
  deadline,
}: InviteToLayoutInnerProps) => {
  return (
    <>
      <PageHeader
        title={title || listing?.Building_Name_for_Process || listing?.Name}
        subtitle={subtitle}
        inverse
        backgroundImage={backgroundImage}
      />
      <div className={styles.submitYourInfo}>
        <div className={styles.submitYourInfoPage}>
          <main
            className={`${styles.submitYourInfoMain}${
              type === INVITE_TO_X.APPLY ? ` ${styles.I2A}` : ""
            }`}
          >
            <InviteToHeader listing={listing} headerText={headerText} />
            <DeadlineBanner deadline={deadline} listing={listing} type={type} />
            {children}
          </main>
          <Desktop>
            <aside className={styles.submitYourInfoSidebar}>
              <InviteToSidebarBlock listing={listing} sidebarText={sidebarText} />
            </aside>
          </Desktop>
        </div>
      </div>
    </>
  )
}

interface InviteToLayoutProps extends Omit<InviteToLayoutInnerProps, "backgroundImage"> {
  getAssetPath: (path: string) => string
}

const InviteToLayout = ({ getAssetPath, ...rest }: InviteToLayoutProps) => {
  return (
    <Layout>
      <InviteToLayoutInner backgroundImage={getAssetPath("bg@1200.jpg")} {...rest} />
    </Layout>
  )
}

export default InviteToLayout
