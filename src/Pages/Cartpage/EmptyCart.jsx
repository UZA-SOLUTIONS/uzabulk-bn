import { Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

import { APP_NAME } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";
import ICON_EMPTY_CART from "../../assets/images/icon-empty-cart.svg";

export default function EmptyCart() {
    return (
        <Row className="justify-content-center">
            <Col lg={6} className="my-3 mb-5">
                <img className="empty-cart" src={ICON_EMPTY_CART} alt="" />
                <p className="empty-cart-title">Your shopping cart is empty.</p>
                <p className="empty-cart-sub-title pb-4">Add products to your cart and order on {APP_NAME} to stay protected with "UZA"</p>
                <Link to={ROUTES.HOME} className="empty-cart-link">Start Sourcing</Link>
            </Col>
        </Row>
    );
}