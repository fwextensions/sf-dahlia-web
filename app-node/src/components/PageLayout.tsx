/**
 * Shared page layout component for static pages.
 * Provides consistent page structure with title and optional subtitle.
 */
interface PageLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function PageLayout({ title, subtitle, children }: PageLayoutProps) {
  return (
    <main className="max-w-5xl mx-auto w-full px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-alt-serif">{title}</h1>
        {subtitle && <p className="mt-2 text-lg text-gray-700">{subtitle}</p>}
      </header>
      <div>{children}</div>
    </main>
  )
}
