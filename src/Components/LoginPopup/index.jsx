import { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import Signin from "./Signin";
import Signup from "./Signup";

export default function LoginPopup({ show, handleClose, initialTab = "signin" }) {
  const [state, setState] = useState({ tab: initialTab });

  useEffect(() => {
    if (show) {
      setState({ tab: initialTab });
    }
  }, [show, initialTab]);

  const setTab = (tab) => {
    setState({ tab });
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      backdrop="static"
      keyboard={false}
      centered
      className="for_loginmod"
    >
      {/* <Modal.Header closeButton>
        <Modal.Title></Modal.Title>
      </Modal.Header> */}
      <Modal.Body>
        <Button className="close_icon" onClick={handleClose}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
          >
            <path
              fill="#000"
              d="m8.382 17.025l-1.407-1.4L10.593 12L6.975 8.4L8.382 7L12 10.615L15.593 7L17 8.4L13.382 12L17 15.625l-1.407 1.4L12 13.41z"
            />
          </svg>
        </Button>

        <div className="tab-frame auth_tab">
          <div className="clearfix">
            <input
              type="radio"
              name="tab"
              id="signin"
              checked={state.tab === "signin"}
              onChange={() => setTab("signin")}
            />
            <label htmlFor="signin">
              <span className="me-2">{signinicon}</span>
              Sign In
            </label>

            <input
              type="radio"
              name="tab"
              id="signup"
              checked={state.tab === "signup"}
              onChange={() => setTab("signup")}
            />
            <label htmlFor="signup">
              <span className="me-2">{signinicon}</span>
              Sign Up
            </label>
          </div>

          {state.tab === "signin" && (
            <div className="auth_modal_content my-3">
              <Signin handleClose={handleClose} />
            </div>
          )}

          {state.tab === "signup" && (
            <div className="auth_modal_content my-3">
              <Signup handleClose={handleClose} />
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}

// svg
const signinicon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
  >
    <path
      fill="#F6A532"
      d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 6v-.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2v.8q0 .825-.587 1.413T18 20H6q-.825 0-1.412-.587T4 18m2 0h12v-.8q0-.275-.137-.5t-.363-.35q-1.35-.675-2.725-1.012T12 15t-2.775.338T6.5 16.35q-.225.125-.363.35T6 17.2zm6-8q.825 0 1.413-.587T14 8t-.587-1.412T12 6t-1.412.588T10 8t.588 1.413T12 10m0 8"
    ></path>
  </svg>
);
