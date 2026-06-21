import { StartClient } from "@tanstack/react-start/client"
import { hydrateRoot } from "react-dom/client"
import { getCurrentLanguage, loadTranslations } from "../../app/javascript/util/languageUtil"
import { initI18nFromStore } from "./lib/i18n/store"
import { initFlagsFromStore } from "./lib/flags/store"

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

  // Activate the feature-flag store the server serialized, so getFlag() resolves
  // the same values the SSR render used (no flash, no hydration mismatch). The
  // browser never contacts Unleash — it reads these serialized values.
  if (window.__DAHLIA_FLAGS__) {
    initFlagsFromStore(window.__DAHLIA_FLAGS__)
  }

  // NOTE: do not wrap in <StrictMode>. In dev, StrictMode double-invokes effects,
  // and the second invocation fires a router state update before TanStack Start's
  // dehydrated Suspense boundary finishes hydrating — React then aborts SSR
  // hydration and switches the boundary to client rendering ("This Suspense
  // boundary received an update before it finished hydrating"). TanStack Start's
  // router hydration is not StrictMode-safe; its recommended client entry omits it.
  hydrateRoot(document, <StartClient />)
}

void bootstrap()
