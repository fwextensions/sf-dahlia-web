import { createFileRoute } from "@tanstack/react-router"
import { SignUp } from "@clerk/tanstack-react-start"

export const Route = createFileRoute("/create-account")({
  component: CreateAccountPage,
})

function CreateAccountPage() {
  return (
    <main>
      <h1>Create Account</h1>
      <SignUp
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />
    </main>
  )
}
