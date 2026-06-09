import React from "react";

export default function UXSkeleton({ type = "product-grid", count = 8 }) {
  if (type === "hero-banner") {
    return (
      <div className="ux-skeleton ux-skeleton-hero">
        <div className="ux-skeleton-hero-card shimmer" />
      </div>
    );
  }

  if (type === "category-circles") {
    return (
      <div className="ux-skeleton ux-skeleton-circles">
        {Array.from({ length: count }).map((_, idx) => (
          <div className="ux-skeleton-circle-item" key={`circle-${idx}`}>
            <span className="ux-skeleton-circle shimmer" />
            <span className="ux-skeleton-line short shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "source-by-category") {
    return (
      <div className="ux-skeleton ux-skeleton-source-cats" aria-hidden>
        <div className="ux-skeleton-source-cats__track">
          {Array.from({ length: count }).map((_, idx) => (
            <div className="ux-skeleton-source-cat-card" key={`source-cat-${idx}`}>
              <span className="ux-skeleton-source-cat-card__line shimmer" />
              <span className="ux-skeleton-source-cat-card__line ux-skeleton-source-cat-card__line--short shimmer" />
              <span className="ux-skeleton-source-cat-card__media shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ux-skeleton ux-skeleton-grid">
      {Array.from({ length: count }).map((_, idx) => (
        <div className="ux-skeleton-card" key={`card-${idx}`}>
          <span className="ux-skeleton-media shimmer" />
          <span className="ux-skeleton-line shimmer" />
          <span className="ux-skeleton-line mid shimmer" />
          <span className="ux-skeleton-line short shimmer" />
        </div>
      ))}
    </div>
  );
}
