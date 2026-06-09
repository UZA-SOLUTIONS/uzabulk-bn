import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { apiGetCategories } from "../../../store/categories/actions";
import ROUTES from "../../../helpers/routesHelper";
import { Dropdown, NavDropdown } from 'react-bootstrap';

// svg icon
import { Fashion, ICON_RIGHT_ARROW } from "../../../assets/svg/index";
import imgone from "../../../assets/images/gursix.jpg";

export default function ItemCategory({ top }) {

    const dispatch = useDispatch();
    const { level1, level2, level3 } = useSelector((s) => s.categories.categories);

    const [activeCategory, setActiveCategory] = useState("");
    const [level1Id, setLevel1Id] = useState("");
    const [level2Id, setLevel2Id] = useState("");
    const [index1, setIndex1] = useState(0);
    const [index2, setIndex2] = useState(0);
    const [display, setDisplay] = useState("none");

    const handleShowMenu = () => {
        setDisplay("block");
    }
    const handleHideMenu = () => {
        setLevel1Id("");
        setLevel2Id("");
        setIndex1(0);
        setIndex2(0);
        setDisplay("none");
    }

    const handleMainMenuClick = (index) => {
        setIndex1(index);
        setIndex2(0);
        setLevel1Id(level1[index]._id);
        setLevel2Id("");
        setActiveCategory("");
    }

    const handleSubMenuClick = (index) => {
        setIndex2(index);
        setLevel2Id(level2[index]._id);
        setActiveCategory(level2[index]?.catName || "");
    }

    useEffect(() => {
        dispatch(apiGetCategories({ level: 1 }));
        dispatch(apiGetCategories({ level: 2 }));
        dispatch(apiGetCategories({ level: 3 }));
    }, []);

    return (
        <li className="productmenu" onMouseEnter={handleShowMenu} onMouseLeave={handleHideMenu}>
            <div className={`position-relative CstmDropdown`}>
                <Link to={ROUTES.CATEGORIES}>

                    <span>{threebar}</span> All Categories
                </Link>

                {/* <div className={`${styles.DropdownMenu} ${styles.FirstLevel} w-100  dropdownMenu position-absolute bg-white p-3 rounded border `}>
                    <ul className="list-unstyled ps-0 mb-0 bg-white overflow-auto">
                        {level1?.map((value, index) => (
                            <li key={index} className={`${index1 === index ? "active" : ""} cursor-pointer`} onMouseEnter={() => handleMainMenuClick(index)}>
                                <Link onClick={handleHideMenu} to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${value._id}&name=${value.catName}`} className="d-flex align-items-center">
                                    <div className="icon_set me-3">
                                        {value?.catImage?.link ? (
                                            <img src={value?.catImage?.link} height={20} width={20} />
                                        ) : (
                                            <Fashion />
                                        )}
                                    </div>
                                    <div className="d-flex justify-content-between w-100">
                                        <p className="mb-0">{value.catName}</p>
                                        {level2?.some(item => item.parent === value._id) ? <div style={{ flexShrink: 0 }}>{ICON_RIGHT_ARROW}</div> : ""}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div> */}
            </div>
            <div
                className={`ps-0 mega_menu_categorie row text-start overflow-hidden bg-transparent`}
                style={{ display, top: `${top + 37}px` }}
            >
                <div className="menu_inner_categories row h-100 position-relative">
                    <div className="position-absolute overlay h-100 w-100" style={{ zIndex: 0 }} onMouseEnter={handleHideMenu}></div>
                    <ul className={`col-3 bg-white h-100 position-relative`} style={{ zIndex: 9 }}>
                        {level1?.map((value, index) => (
                            <li key={index} className={`${index1 === index ? "active" : ""} cursor-pointer`} onMouseEnter={() => handleMainMenuClick(index)}>
                                <Link onClick={handleHideMenu} to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${value._id}&name=${value.catName}`} className="d-flex align-items-center">
                                    <div className="icon_set me-3">
                                        {value?.catImage?.link ? (
                                            <img src={value?.catImage?.link} height={20} width={20} />
                                        ) : (
                                            <Fashion />
                                        )}
                                    </div>
                                    <div className="d-flex justify-content-between w-100 p-0 align-items-center">
                                        <p className="mb-0">{value.catName}</p>
                                        {level2?.some(item => item.parent === value._id) ? <div className="p-0" style={{ flexShrink: 0 }}>{ICON_RIGHT_ARROW}</div> : ""}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {level2?.some(item => item.parent === level1Id) ?
                        <ul style={{ zIndex: 9 }} className={`submenu col-3 bg-white h-100 position-relative`}>
                            {level2?.map((value, index) => {
                                if (value.parent === level1Id) {
                                    return (
                                        <li
                                            key={index}
                                            className={`${index2 === index ? "active" : ""} cursor-pointer`}
                                            onMouseEnter={() => handleSubMenuClick(index)}>
                                            <Link onClick={handleHideMenu} to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${value._id}&name=${value.catName}`} className="d-flex justify-content-between align-items-center">
                                                <p className="mb-0">{value.catName}</p>
                                                {level3?.some(item => item.parent === value._id) ? <div className="p-0" style={{ flexShrink: 0 }}>{ICON_RIGHT_ARROW}</div> : ""}
                                            </Link>
                                        </li>
                                    )
                                }
                                return null;
                            })}
                        </ul> : null}

                    {level3?.some(item => item.parent === level2Id) ? (
                        <div className="whitebackground align-self-start h-auto bg-white h-100 col-6 position-relative mx-0" style={{ zIndex: 9 }}>
                            <div className="carttitle_head d-flex align-item-center mb-3">
                                <h4 className="m-0">{activeCategory}</h4>
                                <span className="ms-3">{arrrowright}</span>
                            </div>
                            <ul className="submenu submenu_third_big w-100" style={{ overflowY: "unset", overflow: "unset" }}>
                                {level3?.map((value, index) => {
                                    if (value.parent === level2Id) {
                                        return (
                                            <li key={index} className="cursor-pointer">
                                                <Link onClick={handleHideMenu} to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${value._id}&name=${value.catName}`} className="text-center">
                                                    <div className="third_ul_img p-0">
                                                        <img
                                                            src={value?.catImage?.link || imgone}
                                                            alt=""
                                                            className="img-fluid"
                                                        />
                                                    </div>
                                                    {value.catName}
                                                </Link>
                                            </li>
                                        )
                                    }
                                    return null;
                                })}
                            </ul>
                        </div>
                    ) : null}
                </div>
            </div>
        </li >
    )
}



const arrrowright = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="40"
        height="40"
        viewBox="0 0 24 24"
    >
        <path
            fill="#F6A532"
            d="M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m.2-9l-.9.9q-.275.275-.275.7t.275.7t.7.275t.7-.275l2.6-2.6q.3-.3.3-.7t-.3-.7l-2.6-2.6q-.275-.275-.7-.275t-.7.275t-.275.7t.275.7l.9.9H9q-.425 0-.712.288T8 12t.288.713T9 13z"
        />
    </svg>
);


// svg icon
const threebar = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 24 24"
    >
        <path
            fill="none"
            stroke="#000"
            stroke-linecap="round"
            stroke-width="2"
            d="M5 6h14M5 12h14M5 18h14"
        />
    </svg>
);