import { createFileRoute } from "@tanstack/react-router"
import { protectedRouteGuard } from "~/lib/auth/protected-route"
import { getAccountProfile } from "~/lib/account/server-fns"

export const Route = createFileRoute("/my-account")({
  beforeLoad: protectedRouteGuard,
  loader: () => getAccountProfile(),
  component: MyAccount,
})

function MyAccount() {
  const profile = Route.useLoaderData()

  return (
    <main>
      <h1>My Account</h1>
      <section aria-label="Profile Information">
        <dl>
          <dt>Email</dt>
          <dd>{profile.email}</dd>

          <dt>Authentication Provider</dt>
          <dd>{profile.provider === "clerk" ? "Clerk" : "Legacy (Devise)"}</dd>

          <dt>Salesforce Contact ID</dt>
          <dd>{profile.salesforceContactId}</dd>
        </dl>
      </section>
      <nav aria-label="Account navigation">
        <ul>
          <li>
            <a href="/my-applications">My Applications</a>
          </li>
          <li>
            <a href="/account/settings">Account Settings</a>
          </li>
        </ul>
      </nav>
    </main>
  )
}
