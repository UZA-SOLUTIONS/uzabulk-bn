import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Container, Row, Col, Breadcrumb } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { APP_NAME } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";
import { apiGetPrivacyPolicyPage } from "../../store/page/actions";

const PrivacyPolicy = () => {
    const dispatch = useDispatch();
    const { isLoading, message, privacyPolicy } = useSelector(s => s.page);

    useEffect(() => {
        dispatch(apiGetPrivacyPolicyPage());
    }, [dispatch]);

    const content = privacyPolicy?.content || message || "";
    const updatedAt = privacyPolicy?.updatedAt || privacyPolicy?.date_modified_utc || privacyPolicy?.createdAt;
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
                <title>{APP_NAME} | Privacy Policy</title>
                <meta
                    name="description"
                    content={`${APP_NAME} privacy policy, including how customer information is collected, used, and protected.`}
                />
            </Helmet>
            <Container>
                <div className="wrap_conatainer privacy_policy_container px-lg-4 p-0">
                    <Breadcrumb className="my-4">
                        <Breadcrumb.Item href={ROUTES.HOME}>Home</Breadcrumb.Item>
                        <Breadcrumb.Item active>Privacy Policy</Breadcrumb.Item>
                    </Breadcrumb>
                    <Row className="justify-content-center mb-5">
                        <Col lg={10} xl={9}>
                            <article className="privacy_policy_card">
                                <div className="privacy_policy_hero">
                                    <span className="privacy_policy_eyebrow">Privacy Notice</span>
                                    <h1>Privacy Policy</h1>
                                    <p>
                                        Learn how {APP_NAME} collects, uses, stores, and protects your
                                        information when you browse, shop, or create an account.
                                    </p>
                                    {formattedUpdatedAt ? (
                                        <small>Last updated: {formattedUpdatedAt}</small>
                                    ) : null}
                                </div>

                                <div className="privacy_policy_content">
                                    {isLoading ? (
                                        <div className="privacy_policy_loading">
                                            Loading privacy policy...
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

export default PrivacyPolicy;
