import { createFileRoute } from "@tanstack/react-router"
import { getMyApplications } from "~/lib/account/server-fns"
import type { SerializableApplication } from "~/lib/account/server-fns"

export const Route = createFileRoute("/$lang/account/applications")({
  loader: () => getMyApplications(),
  component: AccountApplications,
})

function AccountApplications() {
  const applications = Route.useLoaderData()

  return (
    <main>
      <h1>Applications</h1>
      {applications.length === 0 ? (
        <p>You have no applications yet.</p>
      ) : (
        <table aria-label="Your applications">
          <thead>
            <tr>
              <th scope="col">Listing</th>
              <th scope="col">Status</th>
              <th scope="col">Lottery Number</th>
              <th scope="col">Language</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app: SerializableApplication) => (
              <tr key={app.id}>
                <td>{app.listingName ?? app.listingID}</td>
                <td>{app.status}</td>
                <td>{app.lotteryNumber ?? "—"}</td>
                <td>{app.applicationLanguage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
