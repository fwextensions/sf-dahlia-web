import { createFileRoute } from "@tanstack/react-router"
import { SignUp } from "@clerk/tanstack-react-start"

export const Route = createFileRoute("/$lang/create-account")({
  component: CreateAccountPage,
})

function CreateAccountPage() {
  const { lang } = Route.useParams()

  return (
    <main>
      <h1>Create Account</h1>
      <SignUp
        signInUrl={`/${lang}/sign-in`}
        fallbackRedirectUrl={`/${lang}`}
      />
    </main>
  )
}
