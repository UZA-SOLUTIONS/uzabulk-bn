import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { apiGetCategories } from "../../store/categories/actions";

/**
 * Starts level 1 + 2 category requests as soon as the app loads so the home page
 * (and header) can render from Redux without waiting for the home route to mount.
 */
export default function PrefetchHomeCategories() {
  const dispatch = useDispatch();
  const level1Len = useSelector((s) => s.categories.categories.level1?.length ?? 0);
  const level2Len = useSelector((s) => s.categories.categories.level2?.length ?? 0);

  useEffect(() => {
    if (!level1Len) dispatch(apiGetCategories({ level: 1 }));
    if (!level2Len) dispatch(apiGetCategories({ level: 2 }));
  }, [dispatch, level1Len, level2Len]);

  return null;
}
