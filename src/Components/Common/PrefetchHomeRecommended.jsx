import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { getHomeFeedRefreshToken } from "../../helpers/commonHelper";
import { apiGetRecommendedProducts } from "../../store/products/actions";

/** Enough for home row merges; keeps recommender DB/Python work bounded. */
const HOME_RECOMMENDED_LIMIT = 24;
/** Defer so New Arrivals / categories win the first network slice. */
const PREFETCH_DELAY_MS = 2500;

/**
 * Loads personalized `/products/recommended` after initial paint so home sections
 * can use a rotated pool without blocking first load.
 */
export default function PrefetchHomeRecommended() {
  const dispatch = useDispatch();
  const { items, isLoading } = useSelector((s) => s.products.homeRecommendedProducts);
  const lastRefreshRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const refresh = getHomeFeedRefreshToken();
    if (lastRefreshRef.current === refresh && items?.length) {
      return undefined;
    }
    if (isLoading && lastRefreshRef.current === refresh) {
      return undefined;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const runPrefetch = () => {
      lastRefreshRef.current = refresh;
      dispatch(
        apiGetRecommendedProducts({
          limit: HOME_RECOMMENDED_LIMIT,
          refresh,
          suppressGlobalErrorToast: true,
        })
      );
    };

    timerRef.current = window.setTimeout(runPrefetch, PREFETCH_DELAY_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [dispatch, items?.length, isLoading]);

  return null;
}
