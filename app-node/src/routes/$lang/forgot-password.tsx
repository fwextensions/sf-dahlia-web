import { createFileRoute } from "@tanstack/react-router"
import { SignIn } from "@clerk/tanstack-react-start"

/**
 * Forgot password route (with lang prefix).
 * Renders Clerk's SignIn component which includes the "forgot password?" link.
 * Clerk handles the password reset flow internally.
 */
export const Route = createFileRoute("/$lang/forgot-password")({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { lang } = Route.useParams()

  return (
    <main>
      <h1>Forgot Password</h1>
      <SignIn
        signUpUrl={`/${lang}/create-account`}
        fallbackRedirectUrl={`/${lang}`}
      />
    </main>
  )
}
