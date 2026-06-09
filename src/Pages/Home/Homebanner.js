import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import ROUTES from "../../helpers/routesHelper";

const HERO_SLIDES = [
  {
    image: "/bg1.jpg",
    title: "Source smarter, buy in bulk",
    cta: "Browse catalogs",
    to: ROUTES.CATEGORIES,
  },
  {
    image: "/bg2.jpg",
    title: "Everything your business needs",
    cta: "Explore products",
    to: ROUTES.PRODUCT_LISTING,
  },
  {
    image: "/bg3.jpg",
    title: "Your business deserves better sourcing",
    cta: "Get started",
    to: `${ROUTES.HOME}?auth=signup`,
  },
];

const SLIDE_MS = 5500;

const Chevron = ({ dir }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Homebanner = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return undefined;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, []);

  const slide = HERO_SLIDES[activeIndex];
  const goPrev = () => {
    setActiveIndex((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };
  const goNext = () => {
    setActiveIndex((i) => (i + 1) % HERO_SLIDES.length);
  };

  return (
    <section
      className="home_alibaba_hero home_alibaba_hero--slideshow home_alibaba_hero--fullbleed home_alibaba_hero--copy position-relative"
      aria-label="Homepage banner"
    >
      <div className="home_alibaba_hero_slideshow">
        <div
          className="home_alibaba_hero_slides"
          style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
        >
          {HERO_SLIDES.map((item) => (
            <div
              key={item.image}
              className="home_alibaba_hero_slide"
              style={{ backgroundImage: `url(${item.image})` }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="home_alibaba_hero_header_overlay" aria-hidden="true" />
        <div className="home_alibaba_hero_copy">
          <h1 key={`title-${activeIndex}`} className="home_alibaba_hero_copy__title">
            {slide.title}
          </h1>
          <Link
            key={`cta-${activeIndex}`}
            to={slide.to}
            className="home_alibaba_hero_copy__cta"
          >
            {slide.cta}
          </Link>
        </div>
        <button
          type="button"
          className="home_alibaba_hero_arrow home_alibaba_hero_arrow--prev"
          onClick={goPrev}
          aria-label="Previous slide"
        >
          <Chevron dir="prev" />
        </button>
        <button
          type="button"
          className="home_alibaba_hero_arrow home_alibaba_hero_arrow--next"
          onClick={goNext}
          aria-label="Next slide"
        >
          <Chevron dir="next" />
        </button>
      </div>
    </section>
  );
};

export default Homebanner;
