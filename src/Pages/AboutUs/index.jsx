import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Container, Row, Col, Breadcrumb } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { APP_NAME } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";
import { apiGetAboutUsPage } from "../../store/page/actions";

const AboutUs = () => {
  const dispatch = useDispatch();
  const { isLoading, message, aboutUs } = useSelector(s => s.page);

  useEffect(() => {
    dispatch(apiGetAboutUsPage());
  }, []);
  return (
    <section className="blog_us_page">
      <Helmet>
        <title>{APP_NAME} | About Us</title>
      </Helmet>
      <Container>
        <div className="wrap_conatainer px-lg-4 p-0">
          <Breadcrumb className="my-4">
            <Breadcrumb.Item href={ROUTES.HOME}>Home</Breadcrumb.Item>
            <Breadcrumb.Item active>About Us</Breadcrumb.Item>
          </Breadcrumb>
          <Row className="mb-5">
            <Col dangerouslySetInnerHTML={{ __html: aboutUs?.content || message || "" }}></Col>
          </Row>
        </div>
      </Container>
    </section>
  );
};

export default AboutUs;
