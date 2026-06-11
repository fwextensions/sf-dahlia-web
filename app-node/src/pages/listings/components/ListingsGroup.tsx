/**
 * ListingsGroup — collapsible section for a group of listings on directory pages.
 * Adapted from app/javascript/modules/listings/components/ListingsGroup.tsx.
 * Removes the intersection-observer wiring; manages its own open/closed state.
 */
import { useState, type ReactNode } from "react"
import { Button, Icon, type UniversalIconType } from "@bloom-housing/ui-components"

interface ListingsGroupProps {
  children?: ReactNode
  header: string
  hideButtonText: string
  showButtonText: string
  icon?: UniversalIconType
  info?: string
  listingsCount: number
  refKey?: string
  /** If provided, the group starts expanded */
  defaultOpen?: boolean
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
}: ListingsGroupProps) {
  const [showListings, setShowListings] = useState(defaultOpen)

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
          <Button className="w-full" onClick={() => setShowListings(!showListings)}>
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
