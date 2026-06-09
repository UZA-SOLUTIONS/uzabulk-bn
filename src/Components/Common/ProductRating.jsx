import React from "react";

const clampRating = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(5, Math.max(0, n));
};

const ProductRating = ({ rating = 0, count = 0, source, className = "" }) => {
  const score = clampRating(rating);
  const reviewCount = Number(count) || 0;

  if (score <= 0) {
    return <span className={className}>No reviews yet</span>;
  }

  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;
  const stars = [];

  for (let i = 0; i < 5; i += 1) {
    if (i < fullStars) stars.push("full");
    else if (i === fullStars && hasHalf) stars.push("half");
    else stars.push("empty");
  }

  const sourceLabel =
    source === "uza"
      ? "UZA reviews"
      : source === "supplier"
        ? "Supplier rating"
        : "";

  return (
    <span className={`product-rating d-inline-flex align-items-center gap-1 flex-wrap ${className}`}>
      <span className="product-rating__stars" aria-label={`${score} out of 5 stars`}>
        {stars.map((type, idx) => (
          <span
            key={idx}
            className={`product-rating__star product-rating__star--${type}`}
            style={{
              color: type === "empty" ? "#d1d5db" : "#f59e0b",
              opacity: type === "half" ? 0.55 : 1,
            }}
            aria-hidden
          >
            ★
          </span>
        ))}
      </span>
      <span className="product-rating__score">{score.toFixed(1)}</span>
      {reviewCount > 0 ? (
        <span className="product-rating__count">({reviewCount})</span>
      ) : null}
      {sourceLabel ? (
        <span className="product-rating__source text-muted small">{sourceLabel}</span>
      ) : null}
    </span>
  );
};

export default ProductRating;
