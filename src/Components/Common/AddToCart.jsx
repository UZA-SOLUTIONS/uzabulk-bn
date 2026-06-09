import { Button } from "react-bootstrap";

export default function AddToCart({
  onDecrement,
  onIncrement,
  value,
  onChange,
  min = 1,
  disabled = false,
  decrementDisabled = false,
  className = "",
  /** Larger, labeled-friendly stepper for product detail */
  variant = "default",
}) {
  const rootClass = [
    "add-to-cart-wrapper",
    variant === "product" ? "add-to-cart-wrapper--product" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const isProduct = variant === "product";
  const qtyBtnProps = isProduct
    ? { variant: "outline-secondary", className: "add-to-cart-qty-btn" }
    : { variant: undefined, className: undefined };

  return (
    <div className={rootClass} role="group" aria-label="Quantity">
      <Button
        type="button"
        {...qtyBtnProps}
        onClick={() => onDecrement()}
        disabled={decrementDisabled}
        aria-label="Decrease quantity"
      >
        -
      </Button>
      <div className="div_output2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="form-control text-center cart-input"
          value={value}
          aria-label="Quantity"
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") return;
            const parsed = Number.parseInt(raw, 10);
            onChange(Number.isNaN(parsed) ? min : parsed);
          }}
          min={min}
          onKeyUp={(e) => {
            if (e.keyCode === 38) {
              onIncrement();
            } else if (e.keyCode === 40) {
              onDecrement();
            }
          }}
        />
      </div>
      <Button
        type="button"
        {...qtyBtnProps}
        onClick={() => onIncrement()}
        disabled={disabled}
        aria-label="Increase quantity"
      >
        +
      </Button>
    </div>
  );
}
