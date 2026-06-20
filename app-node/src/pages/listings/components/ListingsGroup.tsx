/**
 * ListingsGroup — collapsible section for a group of listings on directory pages.
 * Adapted from app/javascript/modules/listings/components/ListingsGroup.tsx.
 * Removes the intersection-observer wiring; manages its own open/closed state.
 */
import { useState, type ReactNode } from "react"
import { Button, Icon, type UniversalIconType } from "@uic"

interface ListingsGroupProps {
  children?: ReactNode
  header: string
  hideButtonText: string
  showButtonText: string
  icon?: UniversalIconType
  info?: string
  listingsCount: number
  refKey?: string
  /** If provided, the group starts expanded (uncontrolled mode only) */
  defaultOpen?: boolean
  /**
   * Controlled open state. When provided (with onToggle), the parent owns the
   * open/closed state — used so the section nav bar can expand a collapsed
   * section on click. Omit both for self-managed (uncontrolled) behavior.
   */
  open?: boolean
  onToggle?: () => void
}

export function ListingsGroup({
  children,
  header,
  hideButtonText,
  showButtonText,
  icon,
  info,
  listingsCount,
  refKey,
  defaultOpen = false,
  open,
  onToggle,
}: ListingsGroupProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const showListings = open ?? internalOpen
  const toggle = () => (onToggle ? onToggle() : setInternalOpen((v) => !v))

  return (
    <div className="listings-group" id={refKey ?? header}>
      <div className="listings-group__header">
        <div className="listings-group__content">
          <div className="listings-group__icon">
            <Icon size="xlarge" symbol={icon ?? "clock"} />
          </div>
          <div className="listings-group__header-group">
            <h2 className="listings-group__title">{header}</h2>
            {info && <div className="listings-group__info">{info}</div>}
          </div>
        </div>
        <div className="listings-group__button">
          <Button className="w-full" onClick={toggle}>
            {showListings
              ? `${hideButtonText} (${listingsCount})`
              : `${showButtonText} (${listingsCount})`}
          </Button>
        </div>
      </div>
      {showListings && children}
    </div>
  )
}
