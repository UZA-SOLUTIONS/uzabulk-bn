import { useState } from "react";
import { Col, Row } from "react-bootstrap";

export default function FeatureAttributes({ details }) {
    const [viewMore, setViewMore] = useState(false);

    if (!details?.length) return null;


    const toggleViewMore = () => {
        setViewMore(s => !s);
    }

    return (
        <>
            <Row className="text-start product_attribute">
                <Col lg="12">
                    <h3>Product attributes</h3>
                </Col>
                <Col lg="12">
                    <ul className="d-flex flex-wrap text-decoration-none ps-0 mb-0">
                        {details?.map((attr, key) => {
                            if (!viewMore && key > 9)
                                return null;

                            return (
                                <li key={key} className="d-flex w-50">
                                    <span className="w-50 py-2 px-3 border bg-body-tertiary">{attr.attributeNameTrans}</span>
                                    <span className="w-50 py-2 px-3 border">{attr.valueTrans}</span>
                                </li>
                            );
                        })}
                    </ul>
                </Col>

                {!viewMore && details?.length > 10 ? <Col lg="12" className="my-2">
                    <p className="cursor-pointer fw-semibold text-decoration-underline mt-3" onClick={toggleViewMore}>Show More</p>
                </Col> : null}
            </Row>
            <hr className="my-5" />
        </>
    )
}