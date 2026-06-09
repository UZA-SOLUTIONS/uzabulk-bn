import React from "react";
import { Modal } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { setBillingAddress, setShippingAddress } from "../../store/address/slice";

import AddAddress from "../AddAddress";
import { apiGetAddresses } from "../../store/address/actions";

const AddAddressModal = (props) => {
  const dispatch = useDispatch();

  return (
    <Modal
      {...props}
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      <Modal.Header className="position-relative d-flex align-items-center justify-content-between">
        <Modal.Title id="contained-modal-title-vcenter">{props.id ? 'Edit Address' : 'Add Address'}</Modal.Title>
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
        <AddAddress
          id={props?.id || null}
          callback={(res) => {
            dispatch(apiGetAddresses({
              limit: 100,
              skip: 0,
            }));
            props.setAddressEditId(null);
            props.onhide();
            if (props.activeKey === '0')
              dispatch(setBillingAddress(res.data));
            else if (props.activeKey === '1')
              dispatch(setShippingAddress(res.data));
          }} />
      </Modal.Body>
    </Modal>
  );
};

export default AddAddressModal;
