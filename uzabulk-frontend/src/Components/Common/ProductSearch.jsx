import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Autocomplete from "react-autocomplete";
import apiClient from "../../helpers/apiHelper";
import { PRODUCTS } from "../../helpers/urlHelper";
import { logger, resolveMediaUrl } from "../../helpers/commonHelper";
import ROUTES from "../../helpers/routesHelper";
import suggestionPlaceholder from "../../assets/images/default_name.webp";

const DEFAULT_MIN_CHARS = 1;
const DEFAULT_DEBOUNCE_MS = 120;

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

export default function ProductSearch({
    category = "",
    callback = () => { },
    defaultValue = "",
    placeholder = "Search for Products Brands and more...",
    minChars = DEFAULT_MIN_CHARS,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    wrapperClassName = "",
}) {
    const [value, setValue] = useState(defaultValue);
    const [items, setItems] = useState([]);
    const cancelToken = useRef(null);
    const timeoutRef = useRef(null);
    const latestQueryKeyRef = useRef("");
    const suggestionCacheRef = useRef(new Map());

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
    const openSuggestion = (item) => {
        const fallbackOfferId = item?.offerId || item?.topIds || "";
        const resolvedId = item?._id || item?.id || item?.productId || fallbackOfferId;
        if (!resolvedId) return;
        const offerQuery = fallbackOfferId ? `&offerId=${encodeURIComponent(fallbackOfferId)}` : "";
        const searchLabel = item?.name || item?.title || "";
        navigate(`${ROUTES.PRODUCT_DETAIL}/${encodeURIComponent(resolvedId)}?search=${encodeURIComponent(searchLabel)}${offerQuery}`);
    };

    const handleSearch = ({ search, category }) => {
        logger("Autocomplete ::: ", { search, category });
        const trimmedSearch = String(search || "").trim();
        const normalizedCategory = String(category || "").trim();
        const cacheKey = `${trimmedSearch.toLowerCase()}::${normalizedCategory}`;
        const minLen = Math.max(1, Number(minChars) || DEFAULT_MIN_CHARS);

        if (trimmedSearch.length < minLen) {
            setItems([]);
            latestQueryKeyRef.current = "";
            if (cancelToken.current) {
                cancelToken.current.abort();
            }
            clearTimeout(timeoutRef.current);
            return;
        }

        latestQueryKeyRef.current = cacheKey;

        if (suggestionCacheRef.current.has(cacheKey)) {
            setItems(suggestionCacheRef.current.get(cacheKey) || []);
        } else {
            setItems([]);
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
                suggestionCacheRef.current.set(cacheKey, nextItems);
                setItems(nextItems);
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
            }
        }, delay);
    };


    const handleSearchCall = ({ value, category }) => {
        callback({ search: value, category: category });
        handleSearch({ search: value, category: category });
    }

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
        <Autocomplete
            getItemValue={(item) =>
                String(item?.name || item?.title || item?._id || "").trim()
            }
            shouldItemRender={() => true}
            items={items}
            renderMenu={(children, _value, menuStyle) => {
                const count = Array.isArray(children) ? children.length : 0;
                return (
                    <div
                        className={`search-suggestion-modal ${count ? "is-visible" : ""}`}
                        style={
                            menuStyle && typeof menuStyle === "object"
                                ? {
                                      ...menuStyle,
                                      zIndex: 10050,
                                      maxHeight: "min(52vh, 420px)",
                                      overflowY: "auto",
                                  }
                                : undefined
                        }
                    >
                        <div className="search-suggestion-header">Suggestions</div>
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
    );
}
