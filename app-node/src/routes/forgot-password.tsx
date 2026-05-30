import { createFileRoute } from "@tanstack/react-router"
import { SignIn } from "@clerk/tanstack-react-start"

/**
 * Forgot password route.
 * Renders Clerk's SignIn component which includes the "forgot password?" link.
 * Clerk handles the password reset flow internally.
 */
export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <main>
      <h1>Forgot Password</h1>
      <SignIn
        signUpUrl="/create-account"
        fallbackRedirectUrl="/"
      />
    </main>
  )
}
