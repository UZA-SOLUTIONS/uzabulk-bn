import React from "react";

const ProductReviews = ({ reviews = [] }) => {
  if (!reviews?.length) {
    return null;
  }

  return (
    <div className="product-reviews mt-3">
      <h6 className="mb-2">Customer reviews</h6>
      <ul className="list-unstyled mb-0">
        {reviews.map((review, index) => (
          <li key={review._id || index} className="product-reviews__item border-bottom py-2">
            <div className="d-flex justify-content-between align-items-center gap-2">
              <strong className="small">{review.reviewer || "Customer"}</strong>
              <span className="small text-warning">{"★".repeat(Math.min(5, Math.max(0, Number(review.rating) || 0)))}</span>
            </div>
            {review.review ? <p className="small mb-0 mt-1">{review.review}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProductReviews;
