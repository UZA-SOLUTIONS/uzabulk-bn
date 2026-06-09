import React, { useLayoutEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { useDispatch } from "react-redux";

import { APP_NAME } from "../../config/constants";
import { bumpHomeFeedRefreshToken } from "../../helpers/commonHelper";
import { clearHomeCategoryCircleImageCache } from "../../helpers/homeCategoryCircleImageCache";
import { clearHomeFeedProducts } from "../../store/products/slice";

import Homebanner from "./Homebanner";
import Discover from "./Discover";
import { Helmet } from "react-helmet";

const Homepage = () => {
  const dispatch = useDispatch();

  useLayoutEffect(() => {
    bumpHomeFeedRefreshToken();
    clearHomeCategoryCircleImageCache();
    dispatch(clearHomeFeedProducts());
  }, [dispatch]);

  return (
    <>
      <Helmet>
        <title>{APP_NAME} | Home</title>
      </Helmet>
      <div className="home_shared_bg_block">
        <section className="home_main_split text-start">
          <Container>
            <Row className="g-3 align-items-start">
              <Col lg={12} md={12} className="home_main_right">
                <Homebanner />
                <section className="discover_section discover_alibaba py-3 text-start">
                  <Discover />
                </section>
              </Col>
            </Row>
          </Container>
        </section>
      </div>
    </>
  );
};

export default Homepage;
