import { createFileRoute } from "@tanstack/react-router"
import { SignIn } from "@clerk/tanstack-react-start"

/**
 * Reset password route.
 * Uses Clerk's SignIn component configured to show the password reset flow.
 * Users arrive here from the forgot-password email link.
 */
export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  return (
    <main>
      <h1>Reset Password</h1>
      <SignIn
        signUpUrl="/create-account"
        fallbackRedirectUrl="/"
      />
    </main>
  )
}
