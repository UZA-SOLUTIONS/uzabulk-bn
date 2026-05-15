import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { apiGetCategories } from "../../../store/categories/actions";
import { apiGet } from "../../../helpers/apiHelper";
import ROUTES from "../../../helpers/routesHelper";
import styles from "./dropdown.module.scss";

import { Fashion, ICON_RIGHT_ARROW } from "../../../assets/svg/index";
import { PRODUCTS } from "../../../helpers/urlHelper";
import { getProductImageUrl, resolveMediaUrl } from "../../../helpers/commonHelper";

const HOVER_OPEN_MS = 140;
const HOVER_CLOSE_MS = 380;

function supportsFineHover() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export default function ItemCategory({ catalogTrigger = "hamburger" }) {
  const dispatch = useDispatch();
  const { level1, level2, level3 } = useSelector(
    (s) => s.categories.categories
  );

  const [showModal, setShowModal] = useState(false);
  const [level1Id, setLevel1Id] = useState("");
  const [index1, setIndex1] = useState(0);
  const [subcategoryImages, setSubcategoryImages] = useState({});
  const attemptedImageCategoryIdsRef = useRef(new Set());
  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
  }, [clearOpenTimer, clearCloseTimer]);

  const closeModal = useCallback(() => {
    clearTimers();
    setShowModal(false);
  }, [clearTimers]);

  const scheduleOpenHover = useCallback(() => {
    if (!supportsFineHover()) return;
    clearCloseTimer();
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      setShowModal(true);
    }, HOVER_OPEN_MS);
  }, [clearCloseTimer, clearOpenTimer]);

  const scheduleCloseHover = useCallback(() => {
    if (!supportsFineHover()) return;
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setShowModal(false);
    }, HOVER_CLOSE_MS);
  }, [clearOpenTimer, clearCloseTimer]);

  const toggleModalClick = useCallback(() => {
    clearTimers();
    setShowModal((v) => !v);
  }, [clearTimers]);

  const handleMainMenuClick = (index) => {
    setIndex1(index);
    setLevel1Id(level1[index]._id);
  };

  useEffect(() => {
    dispatch(apiGetCategories({ level: 1 }))
      .then(() => dispatch(apiGetCategories({ level: 2 })))
      .then(() => dispatch(apiGetCategories({ level: 3 })));
  }, [dispatch]);

  useEffect(() => {
    if (!level1?.length || level1Id) return;
    setLevel1Id(level1[0]?._id || "");
    setIndex1(0);
  }, [level1, level1Id]);

  useEffect(() => {
    if (!showModal || !level1?.length) return;
    const clamped = Math.min(Math.max(index1, 0), level1.length - 1);
    const id = level1[clamped]?._id || "";
    if (clamped !== index1) setIndex1(clamped);
    if (id && id !== level1Id) setLevel1Id(id);
  }, [showModal, level1, index1, level1Id]);

  const selectedLevel1Id = level1Id || level1?.[0]?._id || "";
  const selectedLevel1 = level1?.[index1] || level1?.[0];
  const selectedLevel2 = useMemo(
    () => level2?.filter((item) => item.parent === selectedLevel1Id) || [],
    [level2, selectedLevel1Id]
  );
  const level3ByParent = useMemo(() => {
    const grouped = {};
    (level3 || []).forEach((item) => {
      if (!item?.parent) return;
      if (!grouped[item.parent]) grouped[item.parent] = [];
      grouped[item.parent].push(item);
    });
    return grouped;
  }, [level3]);

  useEffect(() => {
    const fetchSubcategoryImages = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;

      const categoryIds = selectedLevel2.flatMap((category) => {
        const kids = level3ByParent[category._id] || [];
        if (kids.length) return kids.map((sub) => sub?._id).filter(Boolean);
        return [category._id];
      });
      const uniqueCategoryIds = [...new Set(categoryIds)];
      const missingCategoryIds = uniqueCategoryIds.filter(
        (id) => !subcategoryImages[id] && !attemptedImageCategoryIdsRef.current.has(id)
      );

      if (!missingCategoryIds.length) return;
      missingCategoryIds.forEach((id) => attemptedImageCategoryIdsRef.current.add(id));

      const requests = missingCategoryIds.map(async (categoryId) => {
        try {
          const res = await apiGet(PRODUCTS.LIST, {
            category: categoryId,
            limit: 1,
            skip: 1,
          });
          const firstProduct = res?.data?.items?.[0];
          const image = getProductImageUrl(firstProduct, "");
          return [categoryId, image || null];
        } catch (error) {
          return [categoryId, null];
        }
      });

      const resolved = await Promise.all(requests);
      setSubcategoryImages((prev) => {
        const next = { ...prev };
        let hasChanges = false;
        resolved.forEach(([categoryId, image]) => {
          if (image) {
            next[categoryId] = image;
            hasChanges = true;
          }
        });
        return hasChanges ? next : prev;
      });
    };

    fetchSubcategoryImages();
  }, [selectedLevel2, level3ByParent, subcategoryImages]);

  useEffect(() => {
    if (!showModal || !supportsFineHover()) return;
    const dialog = document.querySelector(
      ".modal.categories-modal-anchor .modal-dialog.categories-modal-dialog-anchor"
    );
    if (!dialog) return;
    const onDialogEnter = () => clearTimers();
    const onDialogLeave = () => {
      clearOpenTimer();
      clearCloseTimer();
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setShowModal(false);
      }, HOVER_CLOSE_MS);
    };
    dialog.addEventListener("mouseenter", onDialogEnter);
    dialog.addEventListener("mouseleave", onDialogLeave);
    return () => {
      dialog.removeEventListener("mouseenter", onDialogEnter);
      dialog.removeEventListener("mouseleave", onDialogLeave);
      clearTimers();
    };
  }, [showModal, clearTimers, clearOpenTimer, clearCloseTimer]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const onNavigate = () => closeModal();

  return (
    <li
      className="productmenu"
      onMouseEnter={scheduleOpenHover}
      onMouseLeave={scheduleCloseHover}
    >
      <button
        type="button"
        className="categories-nav-trigger"
        onClick={toggleModalClick}
        aria-haspopup="dialog"
        aria-expanded={showModal}
      >
        <span className="categories-nav-trigger__icon" aria-hidden>
          {catalogTrigger === "grid" ? appsMenuGrid : threebar}
        </span>
        <span>All Categories</span>
      </button>

      <Modal
        show={showModal}
        onHide={closeModal}
        size="xl"
        scrollable={false}
        backdrop={false}
        enforceFocus={false}
        autoFocus={false}
        restoreFocus={false}
        className="categories-modal-anchor"
        dialogClassName={`${styles.categoriesModalDialog} categories-modal-dialog-anchor`}
        contentClassName="border-0 shadow categories-modal-content"
        aria-labelledby="categories-modal-title"
      >
        <Modal.Header closeButton className="border-bottom py-3 categories-modal-header">
          <Modal.Title id="categories-modal-title" className="fs-5 fw-semibold mb-0">
            Shop by category
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.categoriesModalBody}>
          <div
            className={`row g-0 flex-grow-1 align-items-stretch min-h-0 h-100 ${styles.categoriesModalRow}`}
          >
            <div
              className={`col-12 col-md-3 min-h-0 d-flex flex-column ${styles.modalCategoryColumn}`}
            >
              <ul className={styles.modalCategoryList}>
                {level1?.map((value, index) => (
                  <li key={value._id || index}>
                    <button
                      type="button"
                      className={`${styles.modalCategoryPick} ${
                        index1 === index ? styles.modalCategoryPickActive : ""
                      }`}
                      onClick={() => handleMainMenuClick(index)}
                    >
                      <span className="icon_set flex-shrink-0">
                        {resolveMediaUrl(value?.catImage) ? (
                          <img
                            src={resolveMediaUrl(value?.catImage)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <Fashion />
                        )}
                      </span>
                      <span className="flex-grow-1 text-start">{value.catName}</span>
                      {level2?.some((item) => item.parent === value._id) ? (
                        <span className="flex-shrink-0 opacity-50" aria-hidden>
                          {ICON_RIGHT_ARROW}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              {selectedLevel1 ? (
                <div className={styles.modalCategoryFooter}>
                  <Link
                    to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${selectedLevel1._id}&name=${encodeURIComponent(
                      selectedLevel1.catName || "Category"
                    )}`}
                    onClick={onNavigate}
                  >
                    View all in {selectedLevel1.catName} →
                  </Link>
                </div>
              ) : null}
            </div>

            <div
              className={`col-12 col-md-9 min-h-0 d-flex flex-column ${styles.modalSubColumn}`}
            >
              <div className={styles.featuredScroll}>
                {!selectedLevel2?.length ? (
                  <p className="text-muted small px-3 py-4 mb-0">
                    No subcategories in this section yet. Use the link below to browse
                    products.
                  </p>
                ) : null}
                {selectedLevel2?.map((category) => {
                  const children = level3ByParent[category._id] || [];
                  const previewItems = children.length ? children.slice(0, 7) : [];
                  const showViewAll = children.length > previewItems.length;

                  if (!children.length) {
                    const img =
                      resolveMediaUrl(category?.catImage) ||
                      subcategoryImages[category._id] ||
                      "";
                    return (
                      <div className={styles.featuredSection} key={category._id}>
                        <div className={styles.featuredHeader}>
                          <h6 className="mb-0">{category.catName}</h6>
                          <Link
                            onClick={onNavigate}
                            to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${category._id}&name=${encodeURIComponent(
                              category.catName || "Category"
                            )}`}
                            className={styles.browseLink}
                          >
                            See products
                          </Link>
                        </div>
                        <ul className={styles.featuredItems}>
                          <li>
                            <Link
                              onClick={onNavigate}
                              to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${category._id}&name=${encodeURIComponent(
                                category.catName || "Category"
                              )}`}
                              className={styles.featuredItemLink}
                            >
                              <div className={styles.featuredItemImage}>
                                {img ? (
                                  <img
                                    src={img}
                                    alt=""
                                    className={styles.categoriesModalThumb}
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <span className={styles.noImage}>Sample</span>
                                )}
                              </div>
                              <span>{category.catName}</span>
                            </Link>
                          </li>
                        </ul>
                      </div>
                    );
                  }

                  return (
                    <div className={styles.featuredSection} key={category._id}>
                      <div className={styles.featuredHeader}>
                        <h6 className="mb-0">{category.catName}</h6>
                        <Link
                          onClick={onNavigate}
                          to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${category._id}&name=${encodeURIComponent(
                            category.catName || "Category"
                          )}`}
                          className={styles.browseLink}
                        >
                          Browse all
                        </Link>
                      </div>
                      <ul className={styles.featuredItems}>
                        {previewItems.map((value) => (
                          <li key={value._id}>
                            <Link
                              onClick={onNavigate}
                              to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${value._id}&name=${encodeURIComponent(
                                value.catName || "Category"
                              )}`}
                              className={styles.featuredItemLink}
                            >
                              <div className={styles.featuredItemImage}>
                                {resolveMediaUrl(value?.catImage) ||
                                subcategoryImages[value?._id] ? (
                                  <img
                                    src={
                                      resolveMediaUrl(value?.catImage) ||
                                      subcategoryImages[value?._id]
                                    }
                                    alt=""
                                    className={styles.categoriesModalThumb}
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <span className={styles.noImage}>—</span>
                                )}
                              </div>
                              <span>{value.catName}</span>
                            </Link>
                          </li>
                        ))}
                        {showViewAll ? (
                          <li>
                            <Link
                              onClick={onNavigate}
                              to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${category._id}&name=${encodeURIComponent(
                                category.catName || "Category"
                              )}`}
                              className={styles.featuredItemLink}
                            >
                              <div className={styles.featuredItemImage}>
                                <div className={styles.viewAllIcon}>{gridIcon}</div>
                              </div>
                              <span>View all</span>
                            </Link>
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-top py-2 bg-light categories-modal-footer">
          <Link
            to={ROUTES.CATEGORIES}
            className="small text-decoration-none text-muted"
            onClick={onNavigate}
          >
            Full category directory
          </Link>
        </Modal.Footer>
      </Modal>
    </li>
  );
}

const threebar = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 24 24"
  >
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      d="M5 6h14M5 12h14M5 18h14"
    />
  </svg>
);

const appsMenuGrid = (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const cx = 4 + col * 8;
      const cy = 4 + row * 8;
      return <circle key={i} cx={cx} cy={cy} r="1.75" fill="currentColor" />;
    })}
  </svg>
);

const gridIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"
    />
  </svg>
);
