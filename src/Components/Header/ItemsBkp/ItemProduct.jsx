import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Row, Col } from "react-bootstrap";
import ROUTES from "../../../helpers/routesHelper";
import { logger } from "../../../helpers/commonHelper";

export default function ItemProduct({ top }) {
    const [display, setDisplay] = useState("none");
    const navigate = useNavigate();
    return (
        <li className="productmenu" onMouseEnter={() => {
            logger("onMouseEnter")
            setDisplay('block')
        }} onMouseLeave={() => {
            logger("onMouseLeave")
            setDisplay('none')
        }}>
            <Link to="#">Products {arrowdown} </Link>
            <div className="mega_menu" style={{ display, top: `${top + 37}px` }}>
                <Row>
                    <Col lg={3} md={6} sm={12} onClick={() => {
                        setDisplay("none");
                        navigate(ROUTES.TOP_RANKING_PRODUCT_LISTING);
                    }} className="cursor-pointer">
                        <div className="menu_box text-center">
                            <span>{toprank}</span>
                            <p>Top ranking</p>
                        </div>
                    </Col>

                    <Col lg={3} md={6} sm={12} onClick={() => {
                        setDisplay("none");
                        navigate(ROUTES.NEW_ARRIVALS_PRODUCT_LISTING);
                    }} className="cursor-pointer">
                        <div className="menu_box text-center">
                            <span>{toprank}</span>

                            <p>New arrivals</p>
                        </div>
                    </Col>

                    <Col lg={3} md={6} sm={12} onClick={() => {
                        setDisplay("none");
                        navigate(ROUTES.SAVING_SPOTLIGHT_PRODUCT_LISTING);
                    }} className="cursor-pointer">
                        <div className="menu_box text-center">
                            <span>{toprank}</span>

                            <p>Saving Spotlight</p>
                        </div>
                    </Col>

                    <Col lg={3} md={6} sm={12}>
                        <div className="menu_box_links text-start">
                            <ul>
                                <li>
                                    <Link to="#">Sample center</Link>
                                </li>

                                <li>
                                    <Link to="#">Online Trade Show</Link>
                                </li>

                                <li>
                                    <Link to="#">Tips</Link>
                                </li>

                                <li>
                                    <Link to="#">LIVE</Link>
                                </li>

                                <li>
                                    <Link to="#">Global suppliers</Link>
                                </li>
                            </ul>
                        </div>
                    </Col>
                </Row>
            </div>
        </li>
    );
}


const toprank = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 512 512"
    >
        <path
            fill="currentColor"
            d="M255 471L91.7 387V41h328.6v346zm-147.3-93.74L255 453l149.3-75.76V57H107.7zm187.61-168.34l-14.5-46l38.8-28.73l-48.27-.43L256 87.94l-15.33 45.78l-48.27.43l38.8 28.73l-14.5 46l39.31-28zM254.13 311.5l98.27-49.89v-49.9l-98.14 49.82l-94.66-48.69v50zm.13 32.66l-94.66-48.69v50l94.54 48.62l98.27-49.89v-49.9z"
        />
    </svg>
);

const arrowdown = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
    >
        <path
            fill="currentColor"
            d="M8.12 9.29L12 13.17l3.88-3.88a.996.996 0 1 1 1.41 1.41l-4.59 4.59a.996.996 0 0 1-1.41 0L6.7 10.7a.996.996 0 0 1 0-1.41c.39-.38 1.03-.39 1.42 0"
        />
    </svg>
);