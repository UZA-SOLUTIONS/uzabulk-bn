/**
 * Normalize outbound email HTML branding and copyright year.
 */
function applyEmailCopyrightYear(html = "") {
  const year = String(new Date().getFullYear());
  let out = String(html ?? "");

  out = out
    .replaceAll("[YEAR]", year)
    .replaceAll("[year]", year)
    .replaceAll("[COPYRIGHT_YEAR]", year)
    .replaceAll("[copyright_year]", year);

  // Copyright © 2025 / Copyright &copy; 2021 / Copyright (c) 2024
  out = out.replace(
    /Copyright\s*(?:©|&copy;|\(c\))\s*\d{4}/gi,
    `Copyright © ${year}`
  );

  // Brand: templates/DB may still say "UZA Store"
  out = out.replace(/UZA\s+Store/gi, "UZA Bulk");
  // Unresolved store placeholder → product brand
  out = out.replaceAll("[storeName]", "UZA Bulk");

  // Common copyright phrasing variants
  out = out.replace(
    /All rights reserved to\s+UZA\s+Store/gi,
    "All rights reserved to UZA Bulk"
  );

  return out;
}

module.exports = { applyEmailCopyrightYear };
