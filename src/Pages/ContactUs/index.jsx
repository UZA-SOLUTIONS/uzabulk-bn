import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Container, Row, Col, Breadcrumb } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { APP_NAME } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";
import { apiGetContactUsPage } from "../../store/page/actions";

const ContactUs = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { isLoading, message, contactUs } = useSelector(s => s.page);
  const productInquiry = location.state?.productInquiry;
  const productName = location.state?.productName;

  useEffect(() => {
    dispatch(apiGetContactUsPage());
  }, []);
  return (
    <section className="contact_us_page">
      <Helmet>
        <title>{APP_NAME} | Contact Us</title>
      </Helmet>
      <Container>
        <div className="wrap_conatainer px-lg-4 p-0">
          <Breadcrumb className="my-4">
            <Breadcrumb.Item href={ROUTES.HOME}>Home</Breadcrumb.Item>
            <Breadcrumb.Item active>Contact Us</Breadcrumb.Item>
          </Breadcrumb>
          {productInquiry ? (
            <Row className="mb-4">
              <Col>
                <div className="p-3 border rounded bg-light">
                  <h6 className="mb-2">
                    {productName ? `Inquiry: ${productName}` : "Product inquiry"}
                  </h6>
                  <pre className="small mb-2 text-wrap" style={{ whiteSpace: "pre-wrap" }}>
                    {productInquiry}
                  </pre>
                  <p className="small text-muted mb-0">
                    Copy this message into your email or chat when you contact us below.
                  </p>
                </div>
              </Col>
            </Row>
          ) : null}
          <Row className="mb-5">
            <Col dangerouslySetInnerHTML={{ __html: contactUs?.content || message || "" }}></Col>
          </Row>
        </div>
      </Container>
    </section>
  );
};

export default ContactUs;
