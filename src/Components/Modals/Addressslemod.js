import React from "react";
import { Modal, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import LoadingContent from "../Common/LoadingContent";
import NoRecordFound from "../Common/NoRecordFound";

import { logger } from "../../helpers/commonHelper";
import { setShippingAddress } from "../../store/address/slice";

import { ICON_ADDRESS_HOME, ICON_BUILDING, ICON_LOCATION } from "../../assets/svg";

const Addressslemod = (props) => {
  const dispatch = useDispatch();
  const { isLoading, items } = useSelector((s) => s.address.addresses);
  const shippingAddress = useSelector((s) => s.address.shippingAddress.detail);

  return (
    <Modal
      {...props}
      size="md"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      <Modal.Header className="position-relative d-flex align-items-center justify-content-between">
        <Modal.Title id="contained-modal-title-vcenter">
          My Addresses
        </Modal.Title>
        <Link to="#" onClick={props.onhide}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
          >
            <path
              fill="#000"
              d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"
            />
          </svg>
        </Link>
      </Modal.Header>
      <Modal.Body>
        <h6>Deliver To:</h6>

        <div className="address_select">
          <ul>
            {items?.length ? (
              items.map((item, key) => (
                <li key={key}>
                  <input
                    type="checkbox"
                    id={"f-option-" + key}
                    name={"f-option-" + key}
                    checked={
                      !!shippingAddress?._id
                        ? shippingAddress?._id === item._id
                        : item.default
                    }
                  />
                  <label for="f-option">
                    <div className="address_show d-flex align-items-start mt-3">
                      <div className="icon_home d-flex align-items-center justify-content-center me-2 border">
                        {item?.addressType === "home"
                          ? ICON_ADDRESS_HOME
                          : item?.addressType === "office"
                            ? ICON_BUILDING
                            : ICON_LOCATION}
                      </div>
                      <div className="adreesText text-start">
                        <p>{item?.name}</p>
                        <p>
                          {item?.area}, {item?.houseNo}, {item?.landmark},{" "}
                          {item?.address}
                        </p>
                      </div>
                    </div>
                    <div
                      className="check"
                      onClick={() => {
                        logger(item);
                        dispatch(setShippingAddress(item));
                        props.onhide();
                      }}
                    ></div>
                  </label>

                </li>
              ))
            ) : isLoading ? (
              <LoadingContent />
            ) : (
              <NoRecordFound />
            )}
          </ul>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={props.onhide} className="track_order">
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default Addressslemod;
