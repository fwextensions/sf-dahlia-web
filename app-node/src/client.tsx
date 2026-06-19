import { StartClient } from "@tanstack/react-start/client"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { getCurrentLanguage, loadTranslations } from "../../app/javascript/util/languageUtil"

// Load translations before hydrating so the client's t() resolves the same
// strings the server rendered — otherwise SSR'd native pages hydrate with
// "Missing Translation Phrases" and React reports a text mismatch.
// See docs/tanstack-ssr-plan.md prereq 2. This is the load-before-hydrate form;
// the fuller fix serializes the SSR resource bundle and inits synchronously.
async function bootstrap() {
  try {
    await loadTranslations(getCurrentLanguage(window.location.pathname))
  } catch (err) {
    console.error("[client] loadTranslations failed before hydrate:", err)
  }

  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  )
}

void bootstrap()
