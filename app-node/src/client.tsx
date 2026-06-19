import { StartClient } from "@tanstack/react-start/client"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { getCurrentLanguage, loadTranslations } from "../../app/javascript/util/languageUtil"
import { initI18nFromStore } from "./lib/i18n/store"

// Initialize translations before hydrating so the client's t() resolves the same
// strings the server rendered — otherwise SSR'd pages hydrate with "Missing
// Translation Phrases" and React reports a text mismatch.
//
// Preferred path (prereq 2): the server serialized the translation store into
// window.__DAHLIA_I18N__, so init synchronously from it — no network round-trip.
// Fallback: if the store is absent, fetch the bundles the old way.
async function bootstrap() {
  try {
    const store = window.__DAHLIA_I18N__
    if (store) {
      initI18nFromStore(store)
    } else {
      await loadTranslations(getCurrentLanguage(window.location.pathname))
    }
  } catch (err) {
    console.error("[client] translation init failed before hydrate:", err)
  }

  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  )
}

void bootstrap()
