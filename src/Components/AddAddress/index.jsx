import { ErrorMessage, Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { Button, Col, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";

import MobileNumberField, { MobileError } from "../../Components/Common/MobileNumberField";
import ROUTES from "../../helpers/routesHelper";
import { logger } from "../../helpers/commonHelper";
import { apiAddAddress, apiGetAddress, apiUpdateAddress } from "../../store/address/actions";
import { clearAddressDetails } from "../../store/address/slice";

const AddAddress = ({ callback, id = null }) => {
    const dispatch = useDispatch();
    const { detail } = useSelector((s) => s.address.addressDetail);

    const navigate = useNavigate();

    const [mobileNumber, setMobileNumber] = useState("");
    const [initialValues, setInitialValues] = useState({
        area: "",
        name: "",
        countryCode: "+1",
        mobileNumber: "",
        houseNo: "",
        landmark: "",
        address: "",
        lattitude: 30.715141,
        longitude: 76.72511,
        addressType: "home", // home, office, other,
        default: true,
    });

    const validationSchema = Yup.object().shape({
        area: Yup.string().required("Area is required field."),
        name: Yup.string().required("Name is required field."),
        houseNo: Yup.string().required("House No. is required field."),
        landmark: Yup.string().required("Landmark is required field."),
        address: Yup.string().required("Address is required field."),
        lattitude: Yup.number().optional(),
        longitude: Yup.number().optional(),
        mobileNumber: Yup.string()
            .required("Mobile number is a required field")
            .matches(/^\d{10}$/, "Mobile number must be exactly 10 digits long."),
        countryCode: Yup.string().matches(
            /^\+\d+$/,
            "Country code must start with a '+' and contain only digits"
        ),
    });

    useEffect(() => {
        if (id) {
            dispatch(apiGetAddress(id));
        }
    }, [id]);

    useEffect(() => {
        if (detail) {
            setInitialValues({
                area: detail?.area,
                name: detail?.name,
                countryCode: detail?.countryCode,
                mobileNumber: detail?.mobileNumber,
                houseNo: detail?.houseNo,
                landmark: detail?.landmark,
                address: detail?.address,
                lattitude: detail?.lattitude,
                longitude: detail?.longitude,
                addressType: detail?.addressType,
                default: detail?.default,
            });
            setMobileNumber(`${detail?.countryCode || ""}${detail?.mobileNumber || ""}`);
        }
    }, [detail]);

    useEffect(() => {
        return () => {
            dispatch(clearAddressDetails());
        };
    }, []);

    return (
        <Formik
            initialValues={initialValues}
            onSubmit={(data, { resetForm }) => {
                if (id) {
                    dispatch(
                        apiUpdateAddress({
                            data,
                            id,
                            callback: (res) => {
                                toast.success(res?.message || "Address update successfully.");
                                resetForm();
                                callback(res);
                            },
                        })
                    );
                } else {
                    dispatch(
                        apiAddAddress({
                            data,
                            callback: (res) => {
                                toast.success(
                                    res?.message || "Address added successfully."
                                );
                                resetForm();
                                callback(res);
                            },
                        })
                    );
                }
            }}
            validationSchema={validationSchema}
            enableReinitialize={true}
        >
            {(form) => {
                logger(form.errors);
                return (
                    <div className="text-start">
                        <Form>
                            <Row>
                                <Col md={6} className="my-2">
                                    <label htmlFor="name" className="required">Name</label>
                                    <Field name="name" id="name" className="form-control" />
                                    <ErrorMessage
                                        name="name"
                                        className="text-danger"
                                        component={"p"}
                                    />
                                </Col>
                                <Col md={6} className="my-2">
                                    <div className="position-relative signupinput_phone">
                                        <label htmlFor="altMobileNumber" className="required">Mobile number</label>
                                        <MobileNumberField
                                            className="border rounded bg-white"
                                            defaultValue={mobileNumber}
                                            callback={(code, number) => {
                                                form.setFieldValue("countryCode", code);
                                                form.setFieldValue("mobileNumber", number);
                                            }}
                                        />
                                        <MobileError
                                            value={form.values?.mobileNumber}
                                        />
                                    </div>
                                </Col>
                                <Col md={6} className="my-2">
                                    <label htmlFor="area" className="required">Area</label>
                                    <Field name="area" id="area" className="form-control" />
                                    <ErrorMessage
                                        name="area"
                                        className="text-danger"
                                        component={"p"}
                                    />
                                </Col>

                                <Col md={6} className="my-2">
                                    <label htmlFor="houseNo" className="required">House No.</label>
                                    <Field
                                        name="houseNo"
                                        id="houseNo"
                                        className="form-control"
                                    />
                                    <ErrorMessage
                                        name="houseNo"
                                        className="text-danger"
                                        component={"p"}
                                    />
                                </Col>

                                <Col md={6} className="my-2">
                                    <label htmlFor="landmark" className="required">Landmark</label>
                                    <Field
                                        name="landmark"
                                        id="landmark"
                                        className="form-control"
                                    />
                                    <ErrorMessage
                                        name="landmark"
                                        className="text-danger"
                                        component={"p"}
                                    />
                                </Col>

                                <Col md={6} className="my-2">
                                    <label htmlFor="address" className="required">Address</label>
                                    <Field
                                        name="address"
                                        id="address"
                                        className="form-control"
                                    />
                                    <ErrorMessage
                                        name="address"
                                        className="text-danger"
                                        component={"p"}
                                    />
                                </Col>

                                <Col md={6} className="my-2">
                                    <label htmlFor="addressType">Address Type</label>

                                    <div className="addresstype d-flex align-items-center gap-4">
                                        <div>
                                            <label htmlFor="addressType-home d-flex align-items-center">
                                                <span className="me-2">Home</span>
                                                <Field
                                                    type="radio"
                                                    name="addressType"
                                                    id="addressType-home"
                                                    value="home"
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <label htmlFor="addressType-office d-flex align-items-center">
                                                <span className="me-2">Office</span>
                                                <Field
                                                    type="radio"
                                                    name="addressType"
                                                    id="addressType-office"
                                                    value="office"
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <label htmlFor="addressType-other d-flex align-items-center">
                                                <span className="me-2">Other</span>
                                                <Field
                                                    type="radio"
                                                    name="addressType"
                                                    id="addressType-other"
                                                    value="other"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <ErrorMessage
                                        name="addressType"
                                        className="text-danger"
                                        component={"p"}
                                    />
                                </Col>

                                <Col md={6} className="my-2">
                                    <div className="default_house d-flex align-items-center">
                                        <label htmlFor="houseNo">Default Address</label>
                                        <span className="ms-2">
                                            <Field
                                                type="checkbox"
                                                name="default"
                                                id="default"
                                            />
                                        </span>
                                    </div>
                                    <ErrorMessage
                                        name="default"
                                        className="text-danger"
                                        component={"p"}
                                    />
                                </Col>

                                <Col md={4} className="my-2 pt-4">
                                    <Button type="submit" className="track_order w-100">
                                        Save
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                    </div>
                );
            }}
        </Formik>
    );
};

export default AddAddress;

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
