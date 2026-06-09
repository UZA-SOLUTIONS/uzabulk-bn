import React, { useMemo } from "react";
import { Helmet } from "react-helmet";
import { useLocation } from "react-router-dom";

import { APP_NAME, BRAND_LOGO_PNG } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";
import { QUICK_LINKS } from "../../helpers/seoLinks";

const DEFAULT_DESCRIPTION =
  "Shop wholesale products, new arrivals, and top-rated deals on UZA Store.";

const routeMeta = [
  { startsWith: ROUTES.PRODUCT_DETAIL, title: `Product Details | ${APP_NAME}`, description: "View product details, pricing, and supplier information on UZA Store." },
  { startsWith: ROUTES.PRODUCT_LISTING, title: `All Products | ${APP_NAME}`, description: "Browse all products by category, price, and popularity on UZA Store." },
  { startsWith: ROUTES.CATEGORIES, title: `Categories | ${APP_NAME}`, description: "Explore product categories and discover trusted suppliers on UZA Store." },
  { startsWith: ROUTES.NEW_ARRIVALS_PRODUCT_LISTING, title: `New Arrivals | ${APP_NAME}`, description: "Find the latest products and trending new arrivals on UZA Store." },
  { startsWith: ROUTES.TOP_RANKING_PRODUCT_LISTING, title: `Top Ranking Products | ${APP_NAME}`, description: "Discover top-ranking products selected by customer demand and ratings." },
  { startsWith: ROUTES.BEST_DEAL_PRODUCT_LISTING, title: `Best Deals | ${APP_NAME}`, description: "Compare competitive wholesale prices and featured best-seller deals." },
  { startsWith: ROUTES.SAVING_SPOTLIGHT_PRODUCT_LISTING, title: `Saving Spotlight | ${APP_NAME}`, description: "Find spotlight savings and time-sensitive product offers." },
  { startsWith: ROUTES.BLOG, title: `Blog | ${APP_NAME}`, description: "Read updates, sourcing tips, and e-commerce insights from UZA Store." },
  { startsWith: ROUTES.ABOUT_US, title: `About Us | ${APP_NAME}`, description: "Learn about UZA Store and our global e-commerce platform vision." },
  { startsWith: ROUTES.CONTACT_US, title: `Contact Us | ${APP_NAME}`, description: "Get in touch with UZA Store support and sales teams." },
  { startsWith: ROUTES.PRIVACY_POLICY, title: `Privacy Policy | ${APP_NAME}`, description: "Read UZA Store's privacy policy and data protection practices." },
  { startsWith: ROUTES.T_AND_C, title: `Terms and Conditions | ${APP_NAME}`, description: "Read the terms and conditions for using UZA Store services." },
  { startsWith: ROUTES.CART, title: `Shopping Cart | ${APP_NAME}`, description: "Review products added to your cart before checkout.", noindex: true },
  { startsWith: ROUTES.CHECKOUT, title: `Checkout | ${APP_NAME}`, description: "Secure checkout for your UZA Store order.", noindex: true },
  { startsWith: ROUTES.PROFILE, title: `My Profile | ${APP_NAME}`, description: "Manage your account profile and preferences.", noindex: true },
  { startsWith: ROUTES.MY_ORDERS, title: `My Orders | ${APP_NAME}`, description: "Track your orders and purchase history.", noindex: true },
  { startsWith: ROUTES.ORDER_DETAIL, title: `Order Details | ${APP_NAME}`, description: "View details for your selected order.", noindex: true },
  { startsWith: ROUTES.ORDER_ADDRESS, title: `Address Book | ${APP_NAME}`, description: "Manage shipping and billing addresses.", noindex: true },
  { startsWith: ROUTES.CHANGE_PASSWORD, title: `Change Password | ${APP_NAME}`, description: "Update your account password securely.", noindex: true },
  { startsWith: ROUTES.FORGOT, title: `Forgot Password | ${APP_NAME}`, description: "Reset your UZA Store account password.", noindex: true },
  { startsWith: ROUTES.HOME, title: `${APP_NAME} | Wholesale Marketplace`, description: "UZA Store is a global e-commerce marketplace for wholesale sourcing and trusted suppliers." },
];

const baseUrlFromEnv = (process.env.REACT_APP_SITE_URL || "https://uzabulk.com").replace(/\/+$/, "");

function getBaseUrl() {
  if (baseUrlFromEnv) return baseUrlFromEnv;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

export default function SeoManager() {
  const { pathname, search } = useLocation();
  const baseUrl = getBaseUrl();
  const canonicalPath = `${pathname || "/"}`.replace(/\/+$/, "") || "/";
  const canonicalUrl = `${baseUrl}${canonicalPath}${search || ""}`;

  const meta = useMemo(() => {
    const found = routeMeta.find((item) => pathname.startsWith(item.startsWith));
    return found || routeMeta[routeMeta.length - 1];
  }, [pathname]);

  const robots = meta.noindex ? "noindex, nofollow" : "index, follow";
  const ogImage = `${baseUrl}${BRAND_LOGO_PNG}`;

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: baseUrl || undefined,
    logo: ogImage,
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    url: baseUrl || undefined,
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl}${ROUTES.PRODUCT_LISTING}?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const siteNavigationJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: QUICK_LINKS.map((item, index) => ({
      "@type": "SiteNavigationElement",
      position: index + 1,
      name: item.label,
      url: `${baseUrl}${item.to}`,
    })),
  };

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description || DEFAULT_DESCRIPTION} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={APP_NAME} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description || DEFAULT_DESCRIPTION} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description || DEFAULT_DESCRIPTION} />
      <meta name="twitter:image" content={ogImage} />

      <script type="application/ld+json">{JSON.stringify(organizationJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(websiteJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(siteNavigationJsonLd)}</script>
    </Helmet>
  );
}
