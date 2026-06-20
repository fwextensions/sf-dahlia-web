/**
 * DirectorySectionNav — the sticky directory section nav bar (Enter a lottery /
 * Buy now / Upcoming / Lottery results) with scroll-spy active highlighting,
 * for the native directory pages.
 *
 * Reuses the Rails components directly:
 *  - DirectoryPageNavigationBar renders the bar (SSR-safe markup).
 *  - MenuIntersectionObserver wires the IntersectionObserver/ResizeObserver. All
 *    of its work is in useEffect/useImperativeHandle, so it's a no-op on the
 *    server and only runs on the client.
 *
 * On mount (client only) we register the page header + each section header
 * element with the observer so it can highlight the active section as the user
 * scrolls. Clicking a nav item scrolls to the section (anchor href) and calls
 * onNavigate so the page can expand a collapsed section.
 */
import { useEffect, useRef, useState } from "react"
import DirectoryPageNavigationBar from "../../../../../app/javascript/modules/listings/DirectoryPageNavigationBar"
import {
  MenuIntersectionObserver,
  type MenuIntersectionObserverHandle,
} from "../../../../../app/javascript/modules/listings/util/NavigationBarUtils"
import {
  DIRECTORY_SECTION_INFO,
  RENTAL_DIRECTORY_SECTIONS,
  SALE_DIRECTORY_SECTIONS,
} from "../../../../../app/javascript/modules/constants"
import type { ListingsGroups } from "../../../../../app/javascript/modules/listings/DirectoryHelpers"

interface DirectorySectionNavProps {
  directoryType: "forRent" | "forSale"
  /** Section key -> listings array, for the nav item count labels. */
  groups: Record<string, unknown[]>
  /** Called with the clicked section key so the page can expand a collapsed section. */
  onNavigate: (sectionKey: string) => void
}

export function DirectorySectionNav({
  directoryType,
  groups,
  onNavigate,
}: DirectorySectionNavProps) {
  const [activeItem, setActiveItem] = useState("")
  const observerRef = useRef<MenuIntersectionObserverHandle>(null)

  const sectionKeys =
    directoryType === "forSale" ? SALE_DIRECTORY_SECTIONS : RENTAL_DIRECTORY_SECTIONS
  const directorySectionInfo = sectionKeys.map((key: string) => ({
    key,
    numListings: groups[key]?.length ?? 0,
    ...DIRECTORY_SECTION_INFO[key as keyof typeof DIRECTORY_SECTION_INFO],
  }))

  useEffect(() => {
    // Client only. Observe the page header (for the sticky/intercept styling) and
    // each section header so the observer can set the active nav item on scroll.
    const ids = ["page-header", ...directorySectionInfo.map((s) => s.ref)]
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observerRef.current?.addObservedElement(el)
    }
    // Run once on mount; section/header elements are in the DOM after commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNavigation = (sectionKey: string) => {
    setActiveItem(sectionKey)
    onNavigate(sectionKey)
  }

  return (
    <>
      <MenuIntersectionObserver ref={observerRef} setActiveItem={setActiveItem} />
      <DirectoryPageNavigationBar
        directorySectionInfo={directorySectionInfo}
        activeItem={activeItem}
        listings={groups as unknown as ListingsGroups}
        handleNavigation={handleNavigation}
      />
    </>
  )
}
