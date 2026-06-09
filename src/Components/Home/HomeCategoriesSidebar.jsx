import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import ROUTES from "../../helpers/routesHelper";
import { apiGetCategories } from "../../store/categories/actions";
import placeholder from "../../assets/images/gurfive.jpg";

const HomeCategoriesSidebar = () => {
  const dispatch = useDispatch();
  const level1Categories = useSelector((s) => s.categories.categories.level1 || []);
  const level2Categories = useSelector((s) => s.categories.categories.level2 || []);
  const level3Categories = useSelector((s) => s.categories.categories.level3 || []);
  const [activeLevel1Id, setActiveLevel1Id] = useState("");
  const [isMegaOpen, setIsMegaOpen] = useState(false);

  useEffect(() => {
    if (!level1Categories?.length) {
      dispatch(apiGetCategories({ level: 1 }));
    }
    if (!level2Categories?.length) {
      dispatch(apiGetCategories({ level: 2 }));
    }
    if (!level3Categories?.length) {
      dispatch(apiGetCategories({ level: 3 }));
    }
  }, [dispatch, level1Categories?.length, level2Categories?.length, level3Categories?.length]);

  useEffect(() => {
    if (!activeLevel1Id && level1Categories?.length) {
      setActiveLevel1Id(level1Categories[0]?._id || "");
    }
  }, [activeLevel1Id, level1Categories]);

  const level2ByParent = useMemo(
    () => level2Categories.filter((item) => item.parent === activeLevel1Id),
    [level2Categories, activeLevel1Id]
  );

  const level3Grouped = useMemo(() => {
    const grouped = {};
    level3Categories.forEach((item) => {
      if (!item?.parent) return;
      if (!grouped[item.parent]) grouped[item.parent] = [];
      grouped[item.parent].push(item);
    });
    return grouped;
  }, [level3Categories]);

  return (
    <div
      className="home_categories_sidebar_wrap"
      onMouseLeave={() => setIsMegaOpen(false)}
    >
      <h5 className="home_categories_title">Categories for you</h5>
      <div className={`home_categories_shell ${isMegaOpen && level2ByParent?.length ? "is-open" : ""}`}>
        <div className="alibaba_category_panel home_categories_sidebar h-100">
          <ul>
            {level1Categories.map((category) => {
              const hasChildren = level2Categories.some((item) => item.parent === category._id);
              return (
                <li
                  key={category._id}
                  className={activeLevel1Id === category._id ? "active" : ""}
                  onMouseEnter={() => {
                    setActiveLevel1Id(category._id);
                    setIsMegaOpen(true);
                  }}
                >
                  <Link
                    className="home_category_link"
                  onClick={(e) => {
                    if (!hasChildren) return;
                    const isCompactScreen = window.matchMedia("(max-width: 1199px)").matches;
                    if (!isCompactScreen) return;
                    const alreadyOpen = isMegaOpen && activeLevel1Id === category._id;
                    if (!alreadyOpen) {
                      e.preventDefault();
                      setActiveLevel1Id(category._id);
                      setIsMegaOpen(true);
                    }
                  }}
                    to={`${ROUTES.PRODUCT_LISTING}?category=${category._id}&name=${encodeURIComponent(
                      category.catName || "Category"
                    )}`}
                  >
                    <span className="home_category_name">{category.catName}</span>
                    {hasChildren ? <span className="home_category_chevron">{">"}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        {isMegaOpen && level2ByParent?.length ? (
          <div className="home_categories_mega">
            <div className="home_categories_mega_scroll">
              {level2ByParent.map((level2) => {
                const children = (level3Grouped[level2._id] || []).slice(0, 8);
                return (
                  <div key={level2._id} className="home_categories_section">
                    <div className="home_categories_section_header">
                      <h6>{level2.catName}</h6>
                      <Link
                        to={`${ROUTES.PRODUCT_LISTING}?category=${level2._id}&name=${encodeURIComponent(level2.catName || "Category")}`}
                      >
                        Browse featured selections
                      </Link>
                    </div>
                    <ul className="home_categories_section_items">
                      {children.map((item) => (
                        <li key={item._id}>
                          <Link
                            to={`${ROUTES.PRODUCT_LISTING}?category=${item._id}&name=${encodeURIComponent(item.catName || "Category")}`}
                          >
                            <span className="home_categories_circle_image">
                              <img src={item?.catImage?.link || placeholder} alt={item?.catName || "Category"} />
                            </span>
                            <span>{item.catName}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default HomeCategoriesSidebar;
