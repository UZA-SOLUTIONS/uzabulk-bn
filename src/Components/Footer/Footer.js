import React from "react";
import { Container } from "react-bootstrap";
import { Link } from "react-router-dom";

import { APP_NAME } from "../../config/constants";
import { QUICK_LINKS } from "../../helpers/seoLinks";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer-clean">
      <Container>
        <div className="site-footer-clean__inner">
          <nav className="site-footer-clean__nav" aria-label="Footer">
            {QUICK_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} className="site-footer-clean__link">
                {label}
              </Link>
            ))}
          </nav>
          <p className="site-footer-clean__copy">
            © {year} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
