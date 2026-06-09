import React, { useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { formatNumber, logger } from "../../helpers/commonHelper";
import ROUTES from "../../helpers/routesHelper";

// images
import Congratsimg from "../../assets/images/congrats.png";
import { defaultExchangeRate } from "../../config/constants";

const Congrats = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const calculateTotalAmount = (orders) => {
    if (!!orders) {
      logger(orders);
      return orders?.reduce((total, order) => total + order.orderTotal, 0);
    } else {
      window.location.href = ROUTES.PRODUCT_LISTING;
    }
  };

  useEffect(() => {
    if (!state?.order) {
      navigate(ROUTES.HOME);
    }
  }, [state]);

  return (
    <section className="congrats_page">
      <Helmet>
        <title>Congratulation!</title>
      </Helmet>
      <Container>
        <Row>
          <Col lg={6} md={6} sm={12}>
            <div className="congrats_img">
              <img src={Congratsimg} alt="" className="img-fluid" />
            </div>
          </Col>

          <Col lg={6} md={6} sm={12}>
            <center>
              <div className="consgratulation_Content">
                <h4>Thank you for placing your order on Uzabulk.com.</h4>

                <p className="fs-6">
                  Request you to share us the payment receipt against the order on <br /><span className="text-body">My account {">"} My orders {">"} Upload Receipt</span>.</p>
                <hr />

                {state?.order?.map((order, key) => {
                  return <p key={key} className="fs-6 m-0 p-0">
                    Order ID : {order.customOrderId}
                  </p>
                })}
                <h3>
                  Total amount : {state?.order[0]?.currency?.symbol || defaultExchangeRate?.symbol} {formatNumber(calculateTotalAmount(state?.order))}
                </h3>

                <Link to={ROUTES.HOME} className="mt-3">Go to Home</Link>
              </div>
            </center>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Congrats;
