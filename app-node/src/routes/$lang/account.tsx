import { createFileRoute } from "@tanstack/react-router"
import { protectedRouteGuard } from "~/lib/auth/protected-route"
import { getAccountProfile } from "~/lib/account/server-fns"

export const Route = createFileRoute("/$lang/account")({
  beforeLoad: protectedRouteGuard,
  loader: () => getAccountProfile(),
  component: Account,
})

function Account() {
  const profile = Route.useLoaderData()

  return (
    <main>
      <h1>Account Dashboard</h1>
      <section aria-label="Account overview">
        <p>Welcome back, {profile.email}</p>
        <nav aria-label="Account sections">
          <ul>
            <li>
              <a href="/my-applications">My Applications</a>
            </li>
            <li>
              <a href="/account/settings">Settings</a>
            </li>
            <li>
              <a href="/account/applications">Applications</a>
            </li>
          </ul>
        </nav>
      </section>
    </main>
  )
}
