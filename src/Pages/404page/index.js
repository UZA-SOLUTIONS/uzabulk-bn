import React from "react";
import { Button, Container } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { APP_NAME } from "../../config/constants";

const Pagenotfound = () => {
  const navigate = useNavigate();
  return (
    <section className="errorpage">
      <Helmet>
        <title>{APP_NAME} | Page not found</title>
      </Helmet>
      <Container>
        <div className="erro404page">
          <h1 className="text-white">Page not found</h1>
          <Button className="big-add-token" onClick={() => navigate("/")}>
            <p>Back to Home</p>
          </Button>
        </div>
      </Container>
    </section>
  );
};

export default Pagenotfound;
