/**
 * Native HeaderSidebarLayout — SSR-safe port of
 * app/javascript/layouts/HeaderSidebarLayout.tsx.
 *
 * Renders the PageHeader hero + a two-column article (main content + sidebar).
 * Unlike the Rails version it does NOT wrap in Layout (the native route already
 * supplies AppShell chrome) and the hero background comes from a Vite asset
 * import instead of ConfigContext.getAssetPath.
 */
import type { ReactNode } from "react"
import { PageHeader } from "@uic"
import ContactSideBarBlock from "../../../app/javascript/layouts/Sidebar/ContactSidebarBlock"
import bgImage from "../../../app/assets/images/bg@1200.jpg"
import "../../../app/javascript/layouts/HeaderSidebarLayout.css"

interface HeaderSidebarLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  mainPage?: boolean
  sidebarContent?: ReactNode
}

export function HeaderSidebarLayout({
  children,
  title,
  subtitle,
  mainPage,
  sidebarContent,
}: HeaderSidebarLayoutProps) {
  const classNames = mainPage
    ? "flex flex-wrap flex-col md:flex-row relative m-auto w-full"
    : "flex flex-wrap flex-col md:flex-row relative max-w-5xl lg:m-auto w-full"
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} inverse backgroundImage={bgImage} />
      <article className={classNames}>
        <div className="w-full md:w-2/3" data-testid="info-main-content">
          {children}
        </div>
        {sidebarContent || <ContactSideBarBlock />}
      </article>
    </>
  )
}
