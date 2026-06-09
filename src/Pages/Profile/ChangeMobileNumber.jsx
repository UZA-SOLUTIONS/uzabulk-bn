import { ErrorMessage, Field, Form, Formik } from "formik";
import { useState } from "react";
import { Button, Col, Row } from "react-bootstrap";
import { useDispatch } from "react-redux";
import * as Yup from "yup";
import { toast } from "react-toastify";
import MobileNumberField, { MobileError } from "../../Components/Common/MobileNumberField";
import { apiUpdateProfile, apiVerifyMobile } from "../../store/auth/actions";

const ChangeMobileNumber = ({ changeProfile }) => {
  const dispatch = useDispatch();
  const [isValid, setIsValid] = useState(false);
  const [initialValues, setInitialValues] = useState({
    countryCode: "",
    mobileNumber: "",
  });

  const validationSchema = Yup.object().shape({
    mobileNumber: Yup.string()
      .matches(/^\d+$/, "Mobile number must contain only digits")
      .min(10, "Mobile number must be at least 10 digits long"),
    countryCode: Yup.string().matches(
      /^\+\d+$/,
      "Country code must start with a '+' and contain only digits"
    ),
  });

  const updateMobileValidationSchema = Yup.object().shape({
    mobileNumber: Yup.string()
      .matches(/^\d+$/, "Mobile number must contain only digits")
      .min(10, "Mobile number must be at least 10 digits long"),
    countryCode: Yup.string().matches(
      /^\+\d+$/,
      "Country code must start with a '+' and contain only digits"
    ),
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
                type: "mobile",
              },
              callback: (res) => {
                changeProfile();
              },
            })
          );
        }}
        validationSchema={updateMobileValidationSchema}
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
                    <Row>
                      <Col md={6} className="my-2 pt-4">
                        <Button type="submit" className="track_order w-100">
                          Verify OTP
                        </Button>
                      </Col>
                    </Row>
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
          apiVerifyMobile({
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
                      <label htmlFor="mobileNumber" className="required">
                        Mobile Number
                      </label>
                      <MobileNumberField
                        className="border rounded"
                        callback={(code, number) => {
                          form.setFieldValue("countryCode", code);
                          form.setFieldValue("mobileNumber", number);
                        }}
                      />
                      <MobileError
                        name="mobileNumber"
                        value={form.values?.mobileNumber}
                      />
                    </div>
                  </Col>
                </Row>
                <Row>
                  <Col md={6} className="my-2 pt-4">
                    <Button type="submit" className="track_order w-100">
                      Verify Mobile Number
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

export default ChangeMobileNumber;
