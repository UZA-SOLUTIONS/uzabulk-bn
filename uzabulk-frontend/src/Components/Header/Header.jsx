import React, { useLayoutEffect, useRef, useState } from "react";
import { Container } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import UserAuthCard from "./UserAuthCard";
import ROUTES from "../../helpers/routesHelper";
import { BRAND_LOGO_PNG } from "../../config/constants";
import logoFallback from "../../assets/images/dark_logo.svg";
import Homemenustrip from "./Homemenustrip";
import ProductSearch from "../Common/ProductSearch";

const ICON_IMAGE_SEARCH = (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M7 15l2.5-2.5 2 2L16 10l2.5 2.5"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" />
    <path d="M15.5 6.5v4M13.5 8.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const ICON_MAGNIFIER = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="10.5" cy="10.5" r="6.25" stroke="#111d2b" strokeWidth="2" />
    <path d="M15.2 15.2L21 21" stroke="#111d2b" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function Header() {
  const [searchText, setSearchText] = useState("");
  const [scrollY, setScrollY] = useState(0);
  const navigate = useNavigate();
  const imageSearchInputRef = useRef(null);

  useLayoutEffect(() => {
    const readY = () => window.scrollY ?? document.documentElement.scrollTop ?? 0;
    const onScroll = () => setScrollY(readY());
    setScrollY(readY());
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleHeaderSearch = (event) => {
    event.preventDefault();
    const trimmed = (searchText || "").trim();
    if (!trimmed) return;
    navigate(`${ROUTES.PRODUCT_LISTING}?search=${encodeURIComponent(trimmed)}&skip=1`);
  };

  return (
    <header
      className={`site-header site-header--mockup${scrollY > 4 ? " is-scrolled" : ""} site-header--search-visible`}
    >
      <section className="header-sub-actions">
        <Container fluid className="header-mockup-container px-3 px-sm-4 px-xl-5">
          <div className="header-sub-actions-inner header-mockup-top-row">
            <Link to={ROUTES.HOME} className="navbar-mockup-brand" aria-label="UZABULK Home">
              <img
                src={BRAND_LOGO_PNG}
                alt="UZABULK"
                className="navbar-mockup-brand-logo"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = logoFallback;
                }}
              />
            </Link>

            <form className="header-mockup-search-form" onSubmit={handleHeaderSearch}>
              <div className="header-mockup-search-shell">
                <ProductSearch
                  wrapperClassName="header-mockup-autocomplete"
                  defaultValue={searchText}
                  placeholder="Search products or categories..."
                  callback={({ search }) => setSearchText(search || "")}
                />
                <div className="header-mockup-search-tray">
                  <label
                    className="header-mockup-img-search"
                    htmlFor="header-mockup-image-search-input"
                    title="Search by image"
                  >
                    <input
                      id="header-mockup-image-search-input"
                      ref={imageSearchInputRef}
                      type="file"
                      accept="image/*"
                      className="visually-hidden"
                      tabIndex={-1}
                      onChange={() => {
                        if (imageSearchInputRef.current) imageSearchInputRef.current.value = "";
                      }}
                    />
                    <span className="header-mockup-img-search__icon">{ICON_IMAGE_SEARCH}</span>
                  </label>
                  <button type="submit" className="header-mockup-search-submit" aria-label="Search">
                    {ICON_MAGNIFIER}
                  </button>
                </div>
              </div>
            </form>

            <UserAuthCard navbarPlacement="mockupTop" className="navbar-mockup-top-auth-wrap" />
          </div>
        </Container>
      </section>

      <section className="header-nav-row">
        <Homemenustrip />
      </section>
    </header>
  );
}
