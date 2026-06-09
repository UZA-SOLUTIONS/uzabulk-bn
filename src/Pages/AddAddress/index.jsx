import { useEffect } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";

import { APP_NAME } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";
import { apiGetAddress } from "../../store/address/actions";
import { clearAddressDetails } from "../../store/address/slice";
import AddAddress from "../../Components/AddAddress";

const AddAddressPage = () => {
  const dispatch = useDispatch();
  const profile = useSelector((s) => s.auth.user);
  const { id } = useParams();

  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      dispatch(apiGetAddress(id));
    }
  }, [id]);

  useEffect(() => {
    return () => {
      dispatch(clearAddressDetails());
    };
  }, []);

  return (
    <section className="profile_view">
      <Helmet>
        <title>{APP_NAME} | {id ? "Edit" : "Add"} Address</title>
      </Helmet>
      <Container>
        <Row>
          <Col lg="12" className="text-start mb-3">
            <h4>{id ? "Edit" : "Add"} Address</h4>
          </Col>
          <AddAddress id={id} callback={() => navigate(ROUTES.ORDER_ADDRESS)} />
        </Row>
      </Container>
    </section>
  );
};

export default AddAddressPage;