import { ErrorMessage, Field } from "formik";
import { FormGroup } from "react-bootstrap";
import { useState } from "react";
import { ICON_EYE, ICON_EYE_SLASH, ICON_LOCK } from "../../assets/svg";

export default function PasswordField({
  name = "password",
  placeholder = "Password",
  className = "",
}) {
  const [show, setShow] = useState(false);
  return (
    <FormGroup className={className}>
      <div className="auth-field">
        <span className="auth-field__icon" aria-hidden>
          {ICON_LOCK}
        </span>
        <Field
          className="form-control auth-field__input auth-field__input--password"
          type={show ? "text" : "password"}
          name={name}
          id={name}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="auth-field__eye"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? ICON_EYE : ICON_EYE_SLASH}
        </button>
      </div>
      <ErrorMessage name={name} component="p" className="text-danger" />
    </FormGroup>
  );
}
