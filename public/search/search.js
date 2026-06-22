(function () {
  const API_BASE = window.location.origin + "/api/v1";

  const $ = (sel) => document.querySelector(sel);
  const form = $("#searchForm");
  const input = $("#searchInput");
  const imageBtn = $("#imageSearchBtn");
  const fileInput = $("#imageFileInput");
  const previewWrap = $("#imagePreview");
  const previewImg = $("#previewImg");
  const clearImageBtn = $("#clearImageBtn");
  const resultsEl = $("#results");
  const resultsSection = $("#resultsSection");
  const recommendationsEl = $("#recommendations");
  const recommendationsSection = $("#recommendationsSection");
  const moreLikeThisEl = $("#moreLikeThis");
  const moreLikeThisSection = $("#moreLikeThisSection");
  const moreLikeThisTitle = $("#moreLikeThisTitle");
  const moreLikeThisSubtitle = $("#moreLikeThisSubtitle");
  const loadingEl = $("#loading");
  const loadingText = $("#loadingText");
  const emptyState = $("#emptyState");
  const searchMeta = $("#searchMeta");
  const smartListingCard = $("#smartListingCard");

  let pendingImageFile = null;

  function getDeviceId() {
    const key = "uza_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = "web-" + crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getAuthHeaders() {
    const headers = { deviceid: getDeviceId() };
    const token = localStorage.getItem("uza_auth_token");
    if (token) headers.Authorization = "Bearer " + token;
    return headers;
  }

  function showLoading(text) {
    loadingText.textContent = text || "Searching…";
    loadingEl.classList.remove("hidden");
  }

  function hideLoading() {
    loadingEl.classList.add("hidden");
  }

  function showMeta(html) {
    searchMeta.innerHTML = html;
    searchMeta.classList.remove("hidden");
  }

  function hideMeta() {
    searchMeta.classList.add("hidden");
  }

  function hideSmartListing() {
    smartListingCard.classList.add("hidden");
    smartListingCard.innerHTML = "";
  }

  function showSmartListing(smartListing, attrs) {
    const listing = smartListing?.listing || {};
    const attributes = attrs || smartListing?.attributes || {};
    const title = listing.title_en || attributes.product_type || "Product detected";

    const tags = [
      attributes.category && `Category: ${attributes.category}`,
      attributes.color && `Color: ${attributes.color}`,
      attributes.material && `Material: ${attributes.material}`,
      attributes.size && `Size: ${attributes.size}`,
      listing.moq_suggestion && `MOQ ~${listing.moq_suggestion}`,
      listing.price_usd_suggestion && `~$${listing.price_usd_suggestion}`,
    ].filter(Boolean);

    smartListingCard.innerHTML = `
      <h3>AI Smart Listing</h3>
      <div class="listing-title">${escapeHtml(title)}</div>
      ${listing.description_en ? `<p style="font-size:0.875rem;color:var(--muted);margin-top:0.25rem">${escapeHtml(listing.description_en.slice(0, 160))}${listing.description_en.length > 160 ? "…" : ""}</p>` : ""}
      <div class="attrs">${tags.map((t) => `<span class="attr-tag">${escapeHtml(t)}</span>`).join("")}</div>
    `;
    smartListingCard.classList.remove("hidden");
  }

  function formatPrice(item, symbol) {
    const price = item.price ?? item.compare_price ?? 0;
    return (symbol || "$") + " " + Number(price).toFixed(2);
  }

  function renderProductCard(item, symbol, container) {
    const card = document.createElement("article");
    card.className = "product-card";
    const img = item.featured_image || (Array.isArray(item.images) ? item.images[0] : "") || "";
    const name = item.name || item.short_description || "Product";
    const rating = item.average_rating != null ? `★ ${Number(item.average_rating).toFixed(1)}` : "";
    const matchBadge = item.similarity_score
      ? `<div class="match-badge">${Math.round(Number(item.similarity_score) * 100)}% visual match</div>`
      : item.match_type === "similar_product"
        ? `<div class="match-badge">Similar item</div>`
        : "";

    card.innerHTML = `
      <img src="${img}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect fill=%22%231a2332%22 width=%22200%22 height=%22200%22/></svg>'" />
      <div class="info">
        <h3>${escapeHtml(name)}</h3>
        <div class="price">${formatPrice(item, symbol)}</div>
        ${rating ? `<div class="rating">${rating}</div>` : ""}
        ${matchBadge}
      </div>
    `;
    card.addEventListener("click", () => {
      if (item._id) window.open(`/api/v1/products/view/${item._id}`, "_blank");
    });
    container.appendChild(card);
  }

  function renderProducts(items, container) {
    container.innerHTML = "";
    const symbol = "$";
    items.forEach((item) => renderProductCard(item, symbol, container));
  }

  function renderSearchResults(items, moreLikeThis, recommendations, moreLikeThisSource) {
    resultsEl.innerHTML = "";
    moreLikeThisEl.innerHTML = "";
    recommendationsEl.innerHTML = "";

    if (!items?.length && !moreLikeThis?.length && !recommendations?.length) {
      resultsSection.classList.add("hidden");
      moreLikeThisSection.classList.add("hidden");
      recommendationsSection.classList.add("hidden");
      emptyState.textContent = "No products found. Try different keywords or another image.";
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    if (items?.length) {
      renderProducts(items, resultsEl);
      resultsSection.classList.remove("hidden");
    } else {
      resultsSection.classList.add("hidden");
    }

    if (moreLikeThis?.length) {
      if (moreLikeThisSource?.name) {
        moreLikeThisTitle.textContent = `More like "${moreLikeThisSource.name}"`;
        moreLikeThisSubtitle.textContent = "Find similar wholesale items from your best match";
      } else {
        moreLikeThisTitle.textContent = "More like this";
        moreLikeThisSubtitle.textContent = "Similar items from your top match";
      }
      renderProducts(moreLikeThis, moreLikeThisEl);
      moreLikeThisSection.classList.remove("hidden");
    } else {
      moreLikeThisSection.classList.add("hidden");
    }

    if (recommendations?.length) {
      renderProducts(recommendations, recommendationsEl);
      recommendationsSection.classList.remove("hidden");
    } else {
      recommendationsSection.classList.add("hidden");
    }
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function showError(msg) {
    const el = document.createElement("div");
    el.className = "error-banner";
    el.textContent = msg;
    resultsEl.prepend(el);
  }

  async function searchByText(query) {
    showLoading("AI is expanding your search…");
    hideMeta();
    hideSmartListing();
    const params = new URLSearchParams({ search: query, limit: "24", skip: "1" });
    const res = await fetch(`${API_BASE}/products/list?${params}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    hideLoading();
    if (json.status !== "success") {
      showError(json.message || "Search failed");
      return;
    }
    const data = json.data || {};
    const items = data.items || [];
    const others = data.others || {};
    const moreLikeThis = others.moreLikeThis || [];
    const recommendations = others.recommendations || [];

    if (others.aiSearch || others.smartRecommendations) {
      showMeta(`<strong>AI search</strong> — smart recommendations included`);
    }
    renderSearchResults(items, moreLikeThis, recommendations, others.moreLikeThisSource);
  }

  async function searchByImage(file) {
    showLoading("Uploading image for search…");
    hideMeta();
    hideSmartListing();

    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch(`${API_BASE}/products/ai/image-search?prepare=1`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });
    const uploadJson = await uploadRes.json();
    if (uploadJson.status !== "success") {
      hideLoading();
      showError(uploadJson.message || "Image upload failed.");
      return;
    }

    const imageUrl = uploadJson.data?.others?.imageUrl || "";
    if (!imageUrl) {
      hideLoading();
      showError("Image upload did not return a URL.");
      return;
    }

    showLoading("Smart Listing AI is analyzing your image…");
    const params = new URLSearchParams({ image: imageUrl, limit: "24", skip: "1" });
    const res = await fetch(`${API_BASE}/products/list?${params}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    hideLoading();

    if (json.status !== "success") {
      showError(json.message || "Image search failed. Set DASHSCOPE_API_KEY in .env for smart listing.");
      return;
    }

    const data = json.data || {};
    const items = data.items || [];
    const others = data.others || {};
    const moreLikeThis = others.moreLikeThis || [];
    const recommendations = others.recommendations || [];

    const provider = others.imageSearchProvider || "ai";
    const keyword = others.imageSearchKeyword || others.imageSearchPhrase || "";
    const keywords = (others.imageSearchKeywords || []).slice(0, 5).join(", ");

    let meta = `<strong>Search bar image search</strong> via ${escapeHtml(provider)}`;
    if (keyword) meta += ` — detected: <em>${escapeHtml(keyword)}</em>`;
    if (keywords) meta += ` (${escapeHtml(keywords)})`;
    if (others.smartListing) meta += ` · <strong>Smart Listing</strong> applied`;
    showMeta(meta);

    if (others.smartListing || others.smartListingAttributes) {
      showSmartListing(others.smartListing, others.smartListingAttributes);
    }

    renderSearchResults(items, moreLikeThis, recommendations, others.moreLikeThisSource);
  }

  function setImagePreview(file) {
    pendingImageFile = file;
    previewImg.src = URL.createObjectURL(file);
    previewWrap.classList.remove("hidden");
    imageBtn.classList.add("active");
  }

  function clearImage() {
    pendingImageFile = null;
    fileInput.value = "";
    previewWrap.classList.add("hidden");
    imageBtn.classList.remove("active");
    hideSmartListing();
  }

  imageBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      setImagePreview(file);
      searchByImage(file);
    }
  });

  clearImageBtn.addEventListener("click", clearImage);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (pendingImageFile) {
      searchByImage(pendingImageFile);
      return;
    }
    const q = input.value.trim();
    if (!q) return;
    searchByText(q);
  });

  const dropZone = $(".search-input-wrap");
  ["dragenter", "dragover"].forEach((ev) => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--accent)";
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "";
    });
  });
  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file?.type?.startsWith("image/")) {
      setImagePreview(file);
      searchByImage(file);
    }
  });

  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) return;
    debounce = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: q, limit: "6", skip: "1" });
        const res = await fetch(`${API_BASE}/products/searchAutocomplete?${params}`, {
          headers: getAuthHeaders(),
        });
        const json = await res.json();
        if (json.status === "success" && json.data?.items?.length && !pendingImageFile) {
          const names = json.data.items.slice(0, 3).map((i) => i.name).filter(Boolean);
          if (names.length) {
            showMeta(`Suggestions: ${names.map(escapeHtml).join(" · ")}`);
          }
        }
      } catch (_) { /* ignore */ }
    }, 400);
  });
})();
