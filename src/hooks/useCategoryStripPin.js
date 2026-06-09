import { useEffect, useRef, useState } from "react";

/** Pins a category nav bar flush under the site header while scrolling. */
export function useCategoryStripPin({ enabled = true, bodyClass = "home-catstrip-pinned" } = {}) {
  const catstripSentinelRef = useRef(null);
  const catstripNavRef = useRef(null);
  const catstripPinnedRef = useRef(false);
  const [catstripPinned, setCatstripPinned] = useState(false);
  const [catstripSpacerHeight, setCatstripSpacerHeight] = useState(0);
  const [headerOffset, setHeaderOffset] = useState(120);

  useEffect(() => {
    const header = document.querySelector(".site-header");
    const measureHeader = () => {
      setHeaderOffset(Math.ceil(header?.getBoundingClientRect().height || 120));
    };
    measureHeader();
    window.addEventListener("resize", measureHeader);
    const headerObserver =
      header && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureHeader) : null;
    headerObserver?.observe(header);
    return () => {
      window.removeEventListener("resize", measureHeader);
      headerObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const sentinel = catstripSentinelRef.current;
    const nav = catstripNavRef.current;
    if (!sentinel || !nav) return undefined;

    const clearFixedLayout = () => {
      nav.style.position = "";
      nav.style.top = "";
      nav.style.left = "";
      nav.style.right = "";
      nav.style.width = "";
      nav.style.maxWidth = "";
      nav.style.zIndex = "";
      nav.style.borderRadius = "";
      nav.style.marginLeft = "";
      nav.style.marginRight = "";
      document.body.classList.remove(bodyClass);
    };

    const applyFixedLayout = () => {
      nav.style.position = "fixed";
      nav.style.top = `${headerOffset}px`;
      nav.style.left = "0";
      nav.style.right = "0";
      nav.style.width = "100%";
      nav.style.maxWidth = "100vw";
      nav.style.marginLeft = "0";
      nav.style.marginRight = "0";
      nav.style.borderRadius = "0";
      nav.style.zIndex = "1100";
      document.body.classList.add(bodyClass);
    };

    const updatePin = () => {
      const shouldPin = sentinel.getBoundingClientRect().top <= headerOffset;

      if (shouldPin && !catstripPinnedRef.current) {
        catstripPinnedRef.current = true;
        setCatstripSpacerHeight(nav.offsetHeight);
        setCatstripPinned(true);
        applyFixedLayout();
      } else if (shouldPin && catstripPinnedRef.current) {
        applyFixedLayout();
      } else if (!shouldPin && catstripPinnedRef.current) {
        catstripPinnedRef.current = false;
        clearFixedLayout();
        setCatstripSpacerHeight(0);
        setCatstripPinned(false);
      }
    };

    window.addEventListener("scroll", updatePin, { passive: true });
    window.addEventListener("resize", updatePin, { passive: true });
    updatePin();

    return () => {
      window.removeEventListener("scroll", updatePin);
      window.removeEventListener("resize", updatePin);
      catstripPinnedRef.current = false;
      clearFixedLayout();
      document.body.classList.remove(bodyClass);
    };
  }, [enabled, headerOffset, bodyClass]);

  return {
    catstripSentinelRef,
    catstripNavRef,
    catstripPinned,
    catstripSpacerHeight,
    headerOffset,
  };
}
