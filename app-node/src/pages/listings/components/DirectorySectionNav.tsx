/**
 * DirectorySectionNav — the sticky directory section nav bar (Enter a lottery /
 * Buy now / Upcoming / Lottery results) with scroll-spy active highlighting,
 * for the native directory pages.
 *
 * Reuses the Rails DirectoryPageNavigationBar for the bar markup (icons,
 * classes, sticky CSS), but implements scroll-spy locally rather than reusing
 * the Rails MenuIntersectionObserver. That util keeps its IntersectionObserver
 * state in module-level singletons (and a ResizeObserver that permanently closes
 * over the first-mounted page's setActiveItem), which breaks across client-side
 * navigation: the second directory's observers end up calling the first,
 * now-unmounted page's state setter. A local effect that owns its observers and
 * cleans them up on unmount avoids all of that.
 */
import { useEffect, useRef, useState } from "react"
import DirectoryPageNavigationBar from "../../../../../app/javascript/modules/listings/DirectoryPageNavigationBar"
import {
  DIRECTORY_SECTION_INFO,
  DIRECTORY_PAGE_HEADER,
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
  const activeRef = useRef("")

  const sectionKeys =
    directoryType === "forSale" ? SALE_DIRECTORY_SECTIONS : RENTAL_DIRECTORY_SECTIONS
  const directorySectionInfo = sectionKeys.map((key: string) => ({
    key,
    numListings: groups[key]?.length ?? 0,
    ...DIRECTORY_SECTION_INFO[key as keyof typeof DIRECTORY_SECTION_INFO],
  }))
  const sectionRefs = directorySectionInfo.map((s) => s.ref).join(",")

  useEffect(() => {
    // Client-only scroll-spy. A scroll-position calc (rather than an
    // IntersectionObserver band) so the last section stays highlighted when
    // scrolled to the page bottom. Self-contained + cleaned up on unmount, so it
    // works correctly across client-side navigation between directories.
    const refIds = sectionRefs.split(",").filter(Boolean)
    const sectionEls = refIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)
    const header = document.getElementById(DIRECTORY_PAGE_HEADER)
    const navContainer = document.getElementById("nav-bar-container")
    // Top offset for the "active" line, roughly below the sticky bar.
    const OFFSET = 140

    const setActive = (id: string) => {
      if (activeRef.current !== id) {
        activeRef.current = id
        setActiveItem(id)
      }
    }

    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        // Active = the last section header that has scrolled above the line.
        let current = sectionEls[0]?.id ?? ""
        for (const el of sectionEls) {
          if (el.getBoundingClientRect().top - OFFSET <= 0) current = el.id
          else break
        }
        // A short trailing section can't scroll above the line; when the page is
        // scrolled to the bottom, activate the last section so it's reachable.
        const doc = document.documentElement
        const scrollable = doc.scrollHeight > window.innerHeight + 4
        const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2
        if (scrollable && atBottom) {
          current = sectionEls[sectionEls.length - 1]?.id ?? current
        }
        setActive(current)
        // Make the bar sticky once the page header scrolls out of view (mirrors
        // the Rails directory-page-navigation-bar__header-intercept toggle).
        if (header && navContainer) {
          navContainer.classList.toggle(
            "directory-page-navigation-bar__header-intercept",
            header.getBoundingClientRect().bottom <= 0
          )
        }
      })
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [sectionRefs])

  const handleNavigation = (sectionKey: string) => {
    onNavigate(sectionKey)
  }

  return (
    <DirectoryPageNavigationBar
      directorySectionInfo={directorySectionInfo}
      activeItem={activeItem}
      listings={groups as unknown as ListingsGroups}
      handleNavigation={handleNavigation}
    />
  )
}
