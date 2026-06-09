import React from "react";
import { Container } from "react-bootstrap";
import { Helmet } from "react-helmet";

import Topcategories from "./topcategories";
import Gurantedproducts from "./gurantedproducts";
import Sourceapp from "./sourceapp";
import Prosupplier from "./prosupplier";

import { APP_NAME } from "../../config/constants";

const Products = () => {
  return (
    <section className="product_banner">
      <Helmet>
        <title>{APP_NAME} | Shop</title>
      </Helmet>
      <div className="products_banner">
        <center>
          <h2>Customer Electronics</h2>
          <p>Lorem ipsum dolor sit amet.</p>
        </center>
      </div>

      <Container>
        <Topcategories />

        <Gurantedproducts />

        <Sourceapp />

        <Prosupplier />
      </Container>
    </section>
  );
};

export default Products;
