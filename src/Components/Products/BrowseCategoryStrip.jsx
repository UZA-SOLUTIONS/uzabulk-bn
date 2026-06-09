import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const Chevron = ({ dir }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function BrowseCategoryStrip({
  tabs = [],
  activeTabId = "",
  navRef,
  isPinned = false,
  ariaLabel = "Filter by category",
  onTabClick,
  getTabTo,
  onTabKeyDown,
  tablistId = "browse-category-tablist",
}) {
  const stripScrollRef = useRef(null);
  const tablistRef = useRef(null);
  const [canStripPrev, setCanStripPrev] = useState(false);
  const [canStripNext, setCanStripNext] = useState(false);

  const syncStripArrows = useCallback(() => {
    const el = stripScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setCanStripPrev(scrollLeft > 2);
    setCanStripNext(max > 2 && scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = stripScrollRef.current;
    if (!el) return;
    syncStripArrows();
    el.addEventListener("scroll", syncStripArrows, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncStripArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", syncStripArrows);
      ro?.disconnect();
    };
  }, [syncStripArrows, tabs.length]);

  const scrollStrip = (dir) => {
    const el = stripScrollRef.current;
    if (!el) return;
    const step = Math.max(200, Math.floor(el.clientWidth * 0.55));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const renderTab = (tab, idx) => {
    const isActive = tab.id === activeTabId;
    const tabClassName = `home_discover_browse_catstrip__tab${
      isActive ? " home_discover_browse_catstrip__tab--active" : ""
    }`;
    const href = getTabTo?.(tab);

    if (href) {
      return (
        <Link
          key={tab.id || "all"}
          to={href}
          className={`${tabClassName}${idx > 0 ? " home_discover_browse_catstrip__tab--scroll" : ""}`}
        >
          {tab.label}
        </Link>
      );
    }

    return (
      <button
        key={tab.id || "all"}
        type="button"
        role="tab"
        id={`browse-tab-${tab.id || "all"}`}
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        className={`${tabClassName}${idx > 0 ? " home_discover_browse_catstrip__tab--scroll" : ""}`}
        onClick={() => onTabClick?.(tab.id)}
      >
        {tab.label}
      </button>
    );
  };

  if (!tabs.length) return null;

  return (
    <nav
      ref={navRef}
      className={`home_discover_browse_catstrip${isPinned ? " is-pinned" : ""}`}
      aria-label={ariaLabel}
    >
      <div className="home_discover_browse_catstrip__inner">
        {canStripPrev ? (
          <button
            type="button"
            className="home_discover_browse_catstrip__arrow home_discover_browse_catstrip__arrow--prev"
            aria-label="Scroll categories left"
            onClick={() => scrollStrip("prev")}
          >
            <Chevron dir="prev" />
          </button>
        ) : (
          <span className="home_discover_browse_catstrip__arrow-spacer" aria-hidden />
        )}
        <div ref={stripScrollRef} className="home_discover_browse_catstrip__track">
          <div
            ref={tablistRef}
            id={tablistId}
            className="home_discover_browse_catstrip__tablist"
            role={getTabTo ? undefined : "tablist"}
            onKeyDown={onTabKeyDown}
          >
            {tabs.map((tab, idx) => {
              if (idx === 0) {
                const first = renderTab(tab, idx);
                const hasMore = tabs.length > 1;
                return (
                  <div key="all" className="home_discover_browse_catstrip__sticky_rail">
                    {first}
                    {hasMore ? (
                      <span className="home_discover_browse_catstrip__divider" aria-hidden="true" />
                    ) : null}
                  </div>
                );
              }
              return renderTab(tab, idx);
            })}
          </div>
        </div>
        <button
          type="button"
          className="home_discover_browse_catstrip__arrow home_discover_browse_catstrip__arrow--next"
          aria-label="Scroll categories right"
          disabled={!canStripNext}
          onClick={() => scrollStrip("next")}
        >
          <Chevron dir="next" />
        </button>
      </div>
    </nav>
  );
}
