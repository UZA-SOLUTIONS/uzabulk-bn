import React from "react";
import { Row, Col } from "react-bootstrap";

import NewArrivalProducts from "../../Components/Home/NewArrivalProducts";
import DiscoverBrowseProducts from "../../Components/Home/DiscoverBrowseProducts";
import SourceByCategory from "../../Components/Home/SourceByCategory";
const Discover = () => {
  return (
    <>
      <Row className="g-3 align-items-stretch">
        <Col lg={12}>
          <div className="discover_group_block px-3 w-100">
            <SourceByCategory />
          </div>
        </Col>
      </Row>
      <Row className="g-3 align-items-stretch">
        <Col lg={12} md={12} className="d-flex">
          <NewArrivalProducts />
        </Col>
      </Row>
      <Row className="g-3 align-items-stretch">
        <Col lg={12} md={12}>
          <DiscoverBrowseProducts />
        </Col>
      </Row>
    </>
  );
};

export default Discover;
