/**
 * Native equivalent of the Rails FormLayout body (app/javascript/layouts/
 * FormLayout.tsx) minus the site chrome — the centered gray section the
 * invite-to response cards (withdrawn / contact / deadline-passed) sit in.
 * AppShell supplies the surrounding header/footer.
 */
import type { ReactNode } from "react"

export function FormSection({ children }: { children: ReactNode }) {
  return (
    <section className="bg-gray-300">
      <div className="md:mb-20 md:mt-12 mx-auto max-w-lg print:my-0 print:max-w-full">
        {children}
      </div>
    </section>
  )
}
