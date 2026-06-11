/**
 * ListingsGroupHeader — section header for a group of listings on directory pages.
 * Mirrors app/javascript/modules/listings/ListingsGroupHeader.tsx but without
 * the intersection-observer wiring (not needed for SSR-first pages).
 */
import type { ReactNode } from "react"

interface ListingsGroupHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  refKey: string
  children: ReactNode
}

export function ListingsGroupHeader({
  title,
  subtitle,
  icon,
  refKey,
  children,
}: ListingsGroupHeaderProps) {
  return (
    <div id={refKey}>
      <div className="listings-group__header listings-group__customHeader">
        <div className="listings-group__content">
          {icon && <div className="listings-group__icon">{icon}</div>}
          <div>
            <h2 className="listings-group__title">{title}</h2>
            {subtitle && <div className="listings-group__info">{subtitle}</div>}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
