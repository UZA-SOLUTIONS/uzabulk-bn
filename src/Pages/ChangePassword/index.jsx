import { ErrorMessage, Field, Form, Formik } from "formik";
import { Button, Col, Container, FormGroup, Row } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { APP_NAME } from "../../config/constants";
import { apiChangePassword } from "../../store/auth/actions";

const ChangePasswordPage = () => {
  const dispatch = useDispatch();
  const profile = useSelector((s) => s.auth.user);
  const initialValues = {
    currentPassword: "",
    password: "",
    confirmPassword: "",
  };

  const validationSchema = Yup.object().shape({
    currentPassword: Yup.string()
      .required("Current Password is required")
      .test(
        "len",
        "Password Password must be at least 6 characters",
        (val) => val && val.length >= 6
      )
      .test(
        "number",
        "Password Password must contain at least 1 number",
        (val) => /\d/.test(val)
      )
      .test(
        "letter",
        "Password Password must contain at least 1 letter",
        (val) => /[a-zA-Z]/.test(val)
      ),
    password: Yup.string()
      .required("New Password is required")
      .test(
        "len",
        "New Password must be at least 6 characters",
        (val) => val && val.length >= 6
      )
      .test("number", "New Password must contain at least 1 number", (val) =>
        /\d/.test(val)
      )
      .test("letter", "New Password must contain at least 1 letter", (val) =>
        /[a-zA-Z]/.test(val)
      ),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password"), null], "Passwords must match")
      .required("Confirm Password is required"),
  });

  return (
    <section className="profile_view bg-white px-3 py-4 rounded">
      <Helmet>
        <title>{APP_NAME} | Change Password</title>
      </Helmet>
      <Container>
        <Row>
          <Col lg="12" className="text-start mb-3">
            <h4>Change Password</h4>
          </Col>
          <Formik
            initialValues={initialValues}
            onSubmit={(data, { resetForm }) => {
              dispatch(
                apiChangePassword({
                  body: data,
                  callback: (res) => {
                    toast.success(
                      res?.message || "Password updated successfully."
                    );
                    resetForm();
                  },
                })
              );
            }}
            validationSchema={validationSchema}
          >
            {(form) => {
              return (
                <div className="tab_form">
                  <Form>
                    <Row className="">
                      <Col lg={6}>
                        <FormGroup className="mb-3">
                          <label htmlFor="currentPassword">Current Password</label>
                          <Field
                            name="currentPassword"
                            type="password"
                            id="currentPassword"
                            className="form-control"
                          />
                          <ErrorMessage
                            name="currentPassword"
                            className="text-danger"
                            component={"p"}
                          />
                        </FormGroup>
                        <FormGroup className="mb-3">
                          <label htmlFor="password">New Password</label>
                          <Field
                            name="password"
                            type="password"
                            id="password"
                            className="form-control"
                          />
                          <ErrorMessage name="password" className="text-danger"
                            component={"p"} />
                        </FormGroup>
                        <FormGroup className="mb-4">
                          <label htmlFor="confirmPassword">Confirm Password</label>
                          <Field
                            name="confirmPassword"
                            type="password"
                            id="confirmPassword"
                            className="form-control"
                          />
                          <ErrorMessage
                            name="confirmPassword"
                            className="text-danger"
                            component={"p"}
                          />
                        </FormGroup>
                        <FormGroup>
                          <Button type="submit" className="track_order w-100">Change Password</Button>
                        </FormGroup>
                      </Col>
                    </Row>
                  </Form>
                </div>
              );
            }}
          </Formik>
        </Row>
      </Container>
    </section>
  );
};

export default ChangePasswordPage;

// svg
const chaticon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 256 256"
  >
    <path
      fill="#000"
      d="M216 52H40a12 12 0 0 0-12 12v160a11.89 11.89 0 0 0 6.93 10.88A12.2 12.2 0 0 0 40 236a11.9 11.9 0 0 0 7.69-2.83L81.49 204H216a12 12 0 0 0 12-12V64a12 12 0 0 0-12-12m4 140a4 4 0 0 1-4 4H80a4 4 0 0 0-2.62 1l-34.82 30.06A4 4 0 0 1 36 224V64a4 4 0 0 1 4-4h176a4 4 0 0 1 4 4Zm-56-80a4 4 0 0 1-4 4H96a4 4 0 0 1 0-8h64a4 4 0 0 1 4 4m0 32a4 4 0 0 1-4 4H96a4 4 0 0 1 0-8h64a4 4 0 0 1 4 4"
    />
  </svg>
);
