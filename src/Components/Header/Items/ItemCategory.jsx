import { Link } from "react-router-dom";
import ROUTES from "../../../helpers/routesHelper";

export default function ItemCategory({ catalogTrigger = "hamburger" }) {
  return (
    <li className="productmenu">
      <Link
        to={`${ROUTES.PRODUCT_LISTING}?skip=1`}
        className="categories-nav-trigger"
        aria-label="Browse all products"
      >
        <span className="categories-nav-trigger__icon" aria-hidden>
          {catalogTrigger === "grid" ? appsMenuGrid : threebar}
        </span>
        <span className="categories-nav-trigger__label">All Categories</span>
      </Link>
    </li>
  );
}

const threebar = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 24 24"
  >
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      d="M5 6h14M5 12h14M5 18h14"
    />
  </svg>
);

const appsMenuGrid = (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const cx = 4 + col * 8;
      const cy = 4 + row * 8;
      return <circle key={i} cx={cx} cy={cy} r="1.75" fill="currentColor" />;
    })}
  </svg>
);
