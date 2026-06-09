import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Autocomplete from "react-autocomplete";
import { toast } from "react-toastify";
import apiClient from "../../helpers/apiHelper";
import { uploadImageSearch } from "../../helpers/imageSearchHelper";
import { PRODUCTS } from "../../helpers/urlHelper";
import {
    logger,
    resolveCatalogProductId,
    buildProductDetailUrlFromResolved,
    buildProductDetailUrl,
    resolveMediaUrl,
} from "../../helpers/commonHelper";
import ROUTES from "../../helpers/routesHelper";
import suggestionPlaceholder from "../../assets/images/default_name.webp";

const DEFAULT_MIN_CHARS = 2;
const DEFAULT_DEBOUNCE_MS = 220;
const SUGGESTION_CACHE_MAX = 80;
const SUGGESTION_CACHE_TTL_MS = 5 * 60 * 1000;

function pickAutocompleteList(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.results)) return res.results;
    return [];
}

function resolveSuggestionThumb(raw) {
    if (!raw || typeof raw !== "string") return "";
    const s = raw.trim();
    if (!s) return "";
    if (/^(https?:|data:|blob:)/i.test(s) || s.startsWith("//")) return s;
    if (s.startsWith("/static/") && typeof window !== "undefined") {
        return `${window.location.origin}${s}`;
    }
    return resolveMediaUrl(s) || s;
}

const ICON_IMAGE_SEARCH = (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 15l2.5-2.5 2 2L16 10l2.5 2.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" />
        <path d="M15.5 6.5v4M13.5 8.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

export default function ProductSearch({
    category = "",
    callback = () => { },
    defaultValue = "",
    placeholder = "Search for Products Brands and more...",
    minChars = DEFAULT_MIN_CHARS,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    wrapperClassName = "",
    enableImageSearch = false,
    imageSearchInputId = "product-search-image-input",
}) {
    const [value, setValue] = useState(defaultValue);
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [imageSearchLoading, setImageSearchLoading] = useState(false);
    const cancelToken = useRef(null);
    const timeoutRef = useRef(null);
    const latestQueryKeyRef = useRef("");
    const suggestionCacheRef = useRef(new Map());
    const imageInputRef = useRef(null);

    const navigate = useNavigate();
    const getSuggestionImage = (item) => {
        if (!item) return "";
        if (typeof item?.featured_image === "string" && item.featured_image.trim()) {
            return item.featured_image;
        }
        if (item?.featured_image?.link) {
            return item.featured_image.link;
        }
        if (Array.isArray(item?.images) && item.images.length) {
            const firstImage = item.images[0];
            if (typeof firstImage === "string" && firstImage.trim()) return firstImage;
            if (firstImage?.link) return firstImage.link;
        }
        return "";
    };
    const openSuggestion = async (item) => {
        const searchLabel = item?.name || item?.title || "";
        const resolved = await resolveCatalogProductId(item);
        let path = resolved
            ? buildProductDetailUrlFromResolved(resolved)
            : buildProductDetailUrl(item);
        if (!path) return;
        const joiner = path.includes("?") ? "&" : "?";
        navigate(`${path}${joiner}search=${encodeURIComponent(searchLabel)}`);
    };

    const getCachedSuggestions = (key) => {
        const entry = suggestionCacheRef.current.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > SUGGESTION_CACHE_TTL_MS) {
            suggestionCacheRef.current.delete(key);
            return null;
        }
        suggestionCacheRef.current.delete(key);
        suggestionCacheRef.current.set(key, entry);
        return entry.items || [];
    };

    const setCachedSuggestions = (key, list) => {
        suggestionCacheRef.current.set(key, { items: list, ts: Date.now() });
        while (suggestionCacheRef.current.size > SUGGESTION_CACHE_MAX) {
            const oldestKey = suggestionCacheRef.current.keys().next().value;
            suggestionCacheRef.current.delete(oldestKey);
        }
    };

    const handleSearch = ({ search, category }) => {
        logger("Autocomplete ::: ", { search, category });
        const trimmedSearch = String(search || "").trim();
        const normalizedCategory = String(category || "").trim();
        const cacheKey = `${trimmedSearch.toLowerCase()}::${normalizedCategory}`;
        const minLen = Math.max(1, Number(minChars) || DEFAULT_MIN_CHARS);

        if (trimmedSearch.length < minLen) {
            setItems([]);
            setIsLoading(false);
            latestQueryKeyRef.current = "";
            if (cancelToken.current) {
                cancelToken.current.abort();
            }
            clearTimeout(timeoutRef.current);
            return;
        }

        latestQueryKeyRef.current = cacheKey;

        const cached = getCachedSuggestions(cacheKey);
        if (cached) {
            setItems(cached);
            setIsLoading(false);
        } else {
            setItems([]);
            setIsLoading(true);
        }

        if (cancelToken.current) {
            cancelToken.current.abort();
        }
        clearTimeout(timeoutRef.current);

        const delay = Math.max(0, Number(debounceMs) || DEFAULT_DEBOUNCE_MS);
        timeoutRef.current = setTimeout(async () => {
            const inflightKey = cacheKey;
            cancelToken.current = new AbortController();

            try {
                const params = {
                    search: trimmedSearch,
                    limit: 15,
                    skip: 0,
                };
                if (normalizedCategory) {
                    params.category = normalizedCategory;
                }
                const res = await apiClient.get(PRODUCTS.SEARCH_AUTOCOMPLETE, {
                    params,
                    signal: cancelToken.current.signal,
                    suppressGlobalErrorToast: true,
                });

                if (latestQueryKeyRef.current !== inflightKey) {
                    return;
                }

                const rawList = pickAutocompleteList(res);

                const nextItems = rawList
                    .map((item) => {
                        const rawImg = getSuggestionImage(item);
                        return {
                            ...item,
                            _suggestionImage:
                                resolveSuggestionThumb(rawImg) || suggestionPlaceholder,
                        };
                    })
                    .filter((item) =>
                        !!(item?.name || item?.title || item?._id || item?.offerId)
                    );
                setCachedSuggestions(cacheKey, nextItems);
                setItems(nextItems);
                setIsLoading(false);
            } catch (error) {
                const isCanceledRequest = error?.code === "ERR_CANCELED"
                    || error?.name === "CanceledError"
                    || error?.name === "AbortError";
                if (isCanceledRequest) {
                    logger("Previous request canceled.");
                } else {
                    if (latestQueryKeyRef.current === inflightKey) {
                        setItems([]);
                    }
                    logger("Error during search autocomplete:", error);
                }
                if (latestQueryKeyRef.current === inflightKey) {
                    setIsLoading(false);
                }
            }
        }, delay);
    };


    const handleSearchCall = ({ value, category }) => {
        callback({ search: value, category: category });
        handleSearch({ search: value, category: category });
    };

    const handleImageSearch = async (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (!file.type?.startsWith("image/")) {
            toast.error("Please choose an image file.");
            event.target.value = "";
            return;
        }

        setImageSearchLoading(true);
        try {
            const data = await uploadImageSearch(file, { limit: 32 });
            const imageUrl = data?.others?.imageUrl || "";
            const keyword = data?.others?.imageSearchKeyword || data?.others?.imageSearchPhrase || "";
            const params = new URLSearchParams();
            params.set("skip", "1");
            if (imageUrl) params.set("image", imageUrl);
            if (keyword) params.set("search", keyword);
            navigate(`${ROUTES.PRODUCT_LISTING}?${params.toString()}`);
        } catch (error) {
            toast.error(error?.message || "Could not search by image. Try again.");
            console.error("Image search failed:", error);
        } finally {
            setImageSearchLoading(false);
            if (imageInputRef.current) imageInputRef.current.value = "";
        }
    };

    useEffect(() => {
        setValue(defaultValue);
    }, [defaultValue]);

    useEffect(() => {
        return () => {
            if (cancelToken.current) {
                cancelToken.current.abort();
            }
            clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <>
            <Autocomplete
            getItemValue={(item) =>
                String(item?.name || item?.title || item?._id || "").trim()
            }
            shouldItemRender={() => true}
            items={items}
            renderMenu={(children) => {
                const count = Array.isArray(children) ? children.length : 0;
                const hasNoResults = !isLoading && count === 0 && value.trim().length >= Math.max(1, Number(minChars) || DEFAULT_MIN_CHARS);
                return (
                    <div
                        className={`search-suggestion-modal ${count ? "is-visible" : ""}`}
                        style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            width: "100%",
                            marginTop: 4,
                            zIndex: 10050,
                            maxHeight: "min(52vh, 420px)",
                            overflowY: "auto",
                        }}
                    >
                        <div className="search-suggestion-header">Suggestions</div>
                        {isLoading ? (
                            <div className="search-suggestion-row">
                                <div className="search-suggestion-copy">
                                    <p className="search-suggestion-title mb-0">Searching...</p>
                                </div>
                            </div>
                        ) : null}
                        {hasNoResults ? (
                            <div className="search-suggestion-row">
                                <div className="search-suggestion-copy">
                                    <p className="search-suggestion-title mb-0">No products found</p>
                                </div>
                            </div>
                        ) : null}
                        <div className="search-suggestion-list">{children}</div>
                    </div>
                );
            }}
            renderItem={(item, isHighlighted) =>
                <div
                    key={item?._id || item?.id || item?.offerId || item?.name}
                    className={`search-suggestion-row ${isHighlighted ? "is-highlighted" : ""}`}
                    onClick={() => openSuggestion(item)}
                >
                    <img
                        src={item?._suggestionImage}
                        alt={item?.name || item?.title || "product"}
                        className="search-suggestion-thumb"
                        loading="lazy"
                        decoding="async"
                    />
                    <div className="search-suggestion-copy">
                        <p className="search-suggestion-title">
                            {item?.name || item?.title || "Product"}
                        </p>
                        <span className="search-suggestion-meta">View product details</span>
                    </div>
                </div>
            }
            value={value}
            onChange={(e) => {
                setValue(e.target.value);
                handleSearchCall({ value: e.target.value, category });
            }}
            onSelect={(nextValue, item) => {
                setValue(nextValue);
                if (item) {
                    openSuggestion(item);
                } else {
                    handleSearchCall({ value: nextValue, category });
                }
            }}
            inputProps={{ placeholder, className: "form-control" }}
            wrapperProps={{
                className: ["auto-complete-input", wrapperClassName].filter(Boolean).join(" "),
            }}
            />
            {enableImageSearch ? (
                <label
                    className={`header-mockup-img-search product-search-image-btn${imageSearchLoading ? " is-loading" : ""}`}
                    htmlFor={imageSearchInputId}
                    title={imageSearchLoading ? "Analyzing image…" : "Search by image"}
                    aria-busy={imageSearchLoading}
                >
                    <input
                        id={imageSearchInputId}
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="visually-hidden"
                        tabIndex={-1}
                        disabled={imageSearchLoading}
                        onChange={handleImageSearch}
                    />
                    <span className="header-mockup-img-search__icon">{ICON_IMAGE_SEARCH}</span>
                </label>
            ) : null}
        </>
    );
}
