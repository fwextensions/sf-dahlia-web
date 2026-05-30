import { createFileRoute } from "@tanstack/react-router"
import { SignIn } from "@clerk/tanstack-react-start"

export const Route = createFileRoute("/$lang/reset-password")({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { lang } = Route.useParams()

  return (
    <main>
      <h1>Reset Password</h1>
      <SignIn
        signUpUrl={`/${lang}/create-account`}
        fallbackRedirectUrl={`/${lang}`}
      />
    </main>
  )
}
