import React, { useEffect, useState } from "react";

const HERO_IMAGES = ["/bg1.jpg", "/bg2.jpg", "/bg3.jpg", "/bg4.jpg"];
const SLIDE_MS = 5500;

const Homebanner = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return undefined;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      className="home_alibaba_hero home_alibaba_hero--slideshow home_alibaba_hero--fullbleed position-relative"
      aria-label="Homepage banner"
    >
      <div className="home_alibaba_hero_slideshow">
        <div
          className="home_alibaba_hero_slides"
          style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
        >
          {HERO_IMAGES.map((src) => (
            <div
              key={src}
              className="home_alibaba_hero_slide"
              style={{ backgroundImage: `url(${src})` }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="home_alibaba_hero_header_overlay" aria-hidden="true" />
      </div>
    </section>
  );
};

export default Homebanner;
