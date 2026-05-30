import { createFileRoute } from "@tanstack/react-router"
import { protectedRouteGuard } from "~/lib/auth/protected-route"
import { getMyApplications } from "~/lib/account/server-fns"
import type { SerializableApplication } from "~/lib/account/server-fns"

export const Route = createFileRoute("/$lang/my-applications")({
  beforeLoad: protectedRouteGuard,
  loader: () => getMyApplications(),
  component: MyApplications,
})

function ApplicationStatusBadge({ status }: { status: string }) {
  return <span aria-label={`Status: ${status}`}>{status}</span>
}

function ApplicationCard({
  application,
}: {
  application: SerializableApplication
}) {
  return (
    <article aria-label={`Application for listing ${application.listingID}`}>
      <h3>{application.listingName ?? `Listing ${application.listingID}`}</h3>
      <ApplicationStatusBadge status={application.status} />
      {application.lotteryNumber && (
        <p>Lottery #: {application.lotteryNumber}</p>
      )}
      <p>Language: {application.applicationLanguage}</p>
    </article>
  )
}

function MyApplications() {
  const applications = Route.useLoaderData()

  return (
    <main>
      <h1>My Applications</h1>
      {applications.length === 0 ? (
        <p>You have no applications yet.</p>
      ) : (
        <section aria-label="Application list">
          {applications.map((app) => (
            <ApplicationCard key={app.id} application={app} />
          ))}
        </section>
      )}
    </main>
  )
}
