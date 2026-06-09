import { ErrorMessage, Field, Form, Formik } from "formik";
import { useState } from "react";
import { Button, Col, Row } from "react-bootstrap";
import { useDispatch } from "react-redux";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { apiUpdateProfile, apiVerifyEmail } from "../../store/auth/actions";

const ChangeEmail = ({ changeProfile }) => {
  const dispatch = useDispatch();
  const [isValid, setIsValid] = useState(false);
  const [initialValues, setInitialValues] = useState({
    email: "",
  });

  const validationSchema = Yup.object().shape({
    email: Yup.string().required("Email is a required field").email("Email must be a valid email"),
  });

  const updateEmailValidationSchema = Yup.object().shape({
    email: Yup.string().required().email(),
    otp: Yup.string()
      .required("Verification code is a required field")
      .min(4, "Verification code must be at least 4 characters")
      .max(4, "Verification code must be at most 4 characters")
      .matches(/^\d+$/, "Verification code must contain only digits"),
  });

  if (isValid)
    return (
      <Formik
        initialValues={{ ...initialValues, otp: "" }}
        onSubmit={(data) => {
          dispatch(
            apiUpdateProfile({
              data: {
                ...data,
                type: "email",
              },
              callback: (res) => {
                changeProfile();
              },
            })
          );
        }}
        validationSchema={updateEmailValidationSchema}
        enableReinitialize={true}
      >
        {(form) => {
          return (
            <>
              <Form>
                <div className="text-start my-3">
                  <Row>
                    <Col md={6} className="my-2">
                      <div className="position-relative signupinput_phone">
                        <label htmlFor="otp">Verification Code</label>
                        <Field
                          name={"otp"}
                          placeholder="Enter 4 digit OTP"
                          className="form-control"
                        />
                        <ErrorMessage
                          name="otp"
                          className="text-danger"
                          component={"p"}
                        />
                      </div>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6} className="my-2 mt-4">
                      <Button type="submit" className="track_order w-100">
                        Verify OTP
                      </Button>
                    </Col>
                  </Row>
                </div>
              </Form>
            </>
          );
        }}
      </Formik>
    );

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={(data) => {
        dispatch(
          apiVerifyEmail({
            data,
            callback: (res) => {
              setInitialValues(data);
              toast.success(res.message);
              setIsValid(true);
            },
          })
        );
      }}
      validationSchema={validationSchema}
      enableReinitialize={true}
    >
      {(form) => {
        return (
          <>
            <Form>
              <div className="text-start my-3">
                <Row>
                  <Col md={6} className="my-2">
                    <div className="position-relative signupinput_phone">
                      <label htmlFor="email" className="required">
                        Email
                      </label>
                      <Field
                        name="email"
                        className="form-control"
                        placeholder="Enter email address"
                      />
                      <ErrorMessage
                        name="email"
                        className="text-danger"
                        component={"p"}
                      />
                    </div>
                  </Col>
                </Row>
                <Row>
                  <Col md={6} className="my-2 mt-4">
                    <Button type="submit" className="track_order w-100">
                      Verify Email
                    </Button>
                  </Col>
                </Row>
              </div>
            </Form>
          </>
        );
      }}
    </Formik>
  );
};

export default ChangeEmail;
