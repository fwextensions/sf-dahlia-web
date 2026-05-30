import { createFileRoute } from "@tanstack/react-router"
import { SignIn } from "@clerk/tanstack-react-start"
import { z } from "zod"

const searchSchema = z.object({
  redirect_url: z.string().optional(),
})

export const Route = createFileRoute("/$lang/sign-in")({
  validateSearch: searchSchema,
  component: SignInPage,
})

function SignInPage() {
  const { redirect_url } = Route.useSearch()
  const { lang } = Route.useParams()

  return (
    <main>
      <h1>Sign In</h1>
      <SignIn
        fallbackRedirectUrl={redirect_url || `/${lang}`}
        signUpUrl={`/${lang}/create-account`}
      />
    </main>
  )
}
