import React from "react"
import { t, LoadingOverlay } from "@uic"
import { Card, Heading } from "@bloom-housing/ui-seeds"
import styles from "./invite-to.module.css"
import RailsSaleListing from "../../api/types/rails/listings/RailsSaleListing"
import FormLayout from "../../layouts/FormLayout"
import InviteToLeasingAgentInfo from "./InviteToLeasingAgentInfo"
import InviteToApplyHeader from "./InviteToHeader"

interface InviteToDeadlinePassedProps {
  listing: RailsSaleListing | null
}

/** Chrome-free body (no `<FormLayout>`) so the native app-node route can wrap it
 *  in its own form section under AppShell. */
export const InviteToDeadlinePassedContent = ({ listing }: InviteToDeadlinePassedProps) => {
  return (
    <LoadingOverlay isLoading={!listing}>
        <InviteToApplyHeader listing={listing} />
        <Card className={styles.responseCard}>
          <Card.Header className={styles.responseHeader} divider="flush">
            <Heading priority={2} size="2xl" className={styles.responseHeading}>
              {t("inviteToApplyPage.deadlinePassed.title")}
            </Heading>
            <p className={styles.responseSubtitle}>
              {t("inviteToApplyPage.deadlinePassed.subtitle")}
            </p>
          </Card.Header>
          <Card.Section className={styles.responseSection}>
            <Heading priority={3} size="xl" className={styles.responseHeading}>
              {t("inviteToApplyPage.deadlinePassed.p1", {
                listingName: listing?.Building_Name_for_Process,
              })}
            </Heading>
            <InviteToLeasingAgentInfo listing={listing} />
          </Card.Section>
        </Card>
    </LoadingOverlay>
  )
}

const InviteToDeadlinePassed = (props: InviteToDeadlinePassedProps) => (
  <FormLayout>
    <InviteToDeadlinePassedContent {...props} />
  </FormLayout>
)

export default InviteToDeadlinePassed
