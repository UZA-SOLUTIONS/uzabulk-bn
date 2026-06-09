import React, { useEffect, useState } from "react";
import { Button, Col, Container, Row } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import LoadingContent from "../../Components/Common/LoadingContent";
import NoRecordFound from "../../Components/Common/NoRecordFound";

import { APP_NAME } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";

import { apiDeleteAddress, apiGetAddresses, apiMakeDefaultAddress } from "../../store/address/actions";

import { ICON_ADDRESS_HOME, ICON_BUILDING, ICON_LOCATION } from "../../assets/svg";
import DeletePopup from "../../Components/Modals/DeletePopup";
import RenderAddress from "../../Components/Common/RenderAddress";

const AddressPage = () => {
  const dispatch = useDispatch();
  const profile = useSelector((s) => s.auth.user);
  const { isLoading, items } = useSelector((s) => s.address.addresses);

  const limit = 100;
  const [skip] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [deletePopup, setDeletePopup] = useState(false);

  const fetchRecords = () => {
    dispatch(
      apiGetAddresses({
        limit: limit,
        skip: skip,
      })
    );
  };

  useEffect(() => {
    fetchRecords();
  }, [skip]);
  return (
    <section className="profile_view bg-white px-3 pt-4 pb-2 rounded">
      <Helmet>
        <title>{APP_NAME} | Address</title>
      </Helmet>
      <Container>
        <Row>
          <Col lg={12} className="text-start mb-3">
            <h4>Address</h4>
          </Col>

          <Col lg={4} md={6} sm={12} className="mb-4">
            <div className="wrap_box_address d-flex align-items-center justify-content-center">
              <Link to={ROUTES.CREATE_ADDRESS}>Add Address</Link>
            </div>
          </Col>

          <DeletePopup
            show={deletePopup}
            onhide={() => setDeletePopup(false)}
            onDelete={() => {
              dispatch(apiDeleteAddress({
                id: deleteId, callback: () => {
                  setDeletePopup(false);
                  fetchRecords();
                }
              }))
            }}
          />

          {items?.length ? (
            items.map((address, key) => {
              return (
                <Col lg={4} md={6} sm={12} className="text-start mb-4">
                  <div className="wrap_box_address position-relative">
                    <h5 className="text-capitalize">
                      {address?.addressType === "home"
                        ? ICON_ADDRESS_HOME
                        : address?.addressType === "office"
                          ? ICON_BUILDING
                          : ICON_LOCATION}{" "}
                      {address?.addressType}
                    </h5>

                    <RenderAddress address={address} />

                    <div className="d-flex align-items-center mt-3 gap-2">
                      <Link
                        to={`${ROUTES.CREATE_ADDRESS}/${address._id}`}
                        className="d-inline-block"
                      >
                        Edit
                      </Link>
                      {"|"}
                      <Button
                        className="d-inline-block"
                        onClick={() => {
                          setDeleteId(address._id);
                          setDeletePopup(true);
                        }}
                      >
                        Delete
                      </Button>
                      {address?.default === false && (
                        <>
                          {"|"}
                          <span
                            to="#"
                            className="d-inline-block cursor-pointer"
                            style={{ whiteSpace: "nowrap" }}
                            onClick={() => {
                              dispatch(
                                apiMakeDefaultAddress({
                                  id: address._id,
                                })
                              );
                            }}
                          >
                            Make default
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </Col>
              );
            })
          ) : isLoading ? (
            <LoadingContent />
          ) : (
            <NoRecordFound />
          )}

          {/* <Col lg="12" className="text-start my-5">
            <Pagination
              limit={limit}
              totalPages={totalPages}
              handlePageClick={handlePageClick({ setSkip })}
            />
          </Col> */}
        </Row>
      </Container>
    </section>
  );
};

export default AddressPage;
