import React from "react";
import { Modal, Button } from "react-bootstrap";

const LogoutPopup = ({
  onhide,
  onLogout,
  isLoggingOut = false,
  className = "",
  backdropClassName = "",
  ...modalProps
}) => {
  return (
    <Modal
      {...modalProps}
      onHide={onhide}
      className={`logout-confirmation-modal ${className}`.trim()}
      backdropClassName={`logout-confirmation-backdrop ${backdropClassName}`.trim()}
      size="sm"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      <Modal.Header className="position-relative d-flex align-items-center justify-content-between">
        <Modal.Title id="contained-modal-title-vcenter">
          Confirm Logout
        </Modal.Title>
        <button
          type="button"
          className="btn p-0 border-0 bg-transparent"
          aria-label="Close logout confirmation"
          onClick={onhide}
          disabled={isLoggingOut}
        >
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
        </button>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-1 fw-semibold">Are you sure you want to log out?</p>
        <p className="mb-0 text-muted">
          You will need to sign in again to access your account.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          onClick={onhide}
          variant="dark"
          className="rounded rounded-5 py-1"
          disabled={isLoggingOut}
        >
          Stay Signed In
        </Button>
        <Button
          variant="danger"
          onClick={onLogout}
          className="rounded rounded-5 py-1"
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging out..." : "Log Out"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default LogoutPopup;
