import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Container, Row, Col, Breadcrumb } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { APP_NAME } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";
import { apiGetTermAndConditionsPage } from "../../store/page/actions";

const TermsAndConditions = () => {
    const dispatch = useDispatch();
    const { isLoading, message, termAndConditions } = useSelector(s => s.page);

    useEffect(() => {
        dispatch(apiGetTermAndConditionsPage());
    }, [dispatch]);

    const content = termAndConditions?.content || message || "";
    const updatedAt = termAndConditions?.updatedAt || termAndConditions?.date_modified_utc || termAndConditions?.createdAt;
    const formattedUpdatedAt = updatedAt
        ? new Date(updatedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        : null;

    return (
        <section className="privacy_policy_page">
            <Helmet>
                <title>{APP_NAME} | Terms and Conditions</title>
                <meta
                    name="description"
                    content={`${APP_NAME} terms and conditions, including customer responsibilities, purchases, payments, returns, and use of the platform.`}
                />
            </Helmet>
            <Container>
                <div className="wrap_conatainer privacy_policy_container px-lg-4 p-0">
                    <Breadcrumb className="my-4">
                        <Breadcrumb.Item href={ROUTES.HOME}>Home</Breadcrumb.Item>
                        <Breadcrumb.Item active>Terms and Conditions</Breadcrumb.Item>
                    </Breadcrumb>
                    <Row className="justify-content-center mb-5">
                        <Col lg={10} xl={9}>
                            <article className="privacy_policy_card">
                                <div className="privacy_policy_hero">
                                    <span className="privacy_policy_eyebrow">Legal Agreement</span>
                                    <h1>Terms and Conditions</h1>
                                    <p>
                                        Please read these terms carefully. They explain the rules for
                                        using {APP_NAME}, placing orders, making payments, and accessing
                                        our services.
                                    </p>
                                    {formattedUpdatedAt ? (
                                        <small>Last updated: {formattedUpdatedAt}</small>
                                    ) : null}
                                </div>

                                <div className="privacy_policy_content">
                                    {isLoading ? (
                                        <div className="privacy_policy_loading">
                                            Loading terms and conditions...
                                        </div>
                                    ) : (
                                        <div dangerouslySetInnerHTML={{ __html: content }} />
                                    )}
                                </div>
                            </article>
                        </Col>
                    </Row>
                </div>
            </Container>
        </section>
    );
};

export default TermsAndConditions;
