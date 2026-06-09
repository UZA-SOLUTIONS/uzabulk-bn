import React, { useEffect } from "react";
import { Button, Col, Container, Row, Table } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import moment from "moment";
import { useNavigate, useParams } from "react-router-dom";

import NoRecordFound from "../../Components/Common/NoRecordFound";
import RenderAddress from "../../Components/Common/RenderAddress";

import { APP_NAME, defaultExchangeRate } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";

import { apiGetOrderDetail } from "../../store/order/actions";
import { removeOrderDetails } from "../../store/order/slice";
import { formatNumber } from "../../helpers/commonHelper";
import LoadingContent from "../../Components/Common/LoadingContent";

// "pending", "confirmed", "inroute", "completed", "refunded", "rejected", "cancelled", "archived"
const cancelStates = ["pending", "confirmed", "inroute"];

const OrderDetailPage = () => {
  const dispatch = useDispatch();
  const { currentCurrency } = useSelector(s => s.config);
  const profile = useSelector((s) => s.auth.user);
  const detail = useSelector((s) => s.order.detail);
  const isLoading = useSelector((s) => s.order.isLoading);

  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(apiGetOrderDetail(id));

    return () => {
      dispatch(removeOrderDetails());
    }
  }, [id]);
  return (
    <section className="profile_view bg-white px-3 pt-4 pb-2 rounded">
      <Helmet>
        <title>{APP_NAME} | Order Detail</title>
      </Helmet>
      <Container>
        <Row>
          {detail ? (
            <>
              <Col lg="12" className="text-start mb-3">
                <div className="d-flex align-items-center justify-content-between gap-5 border-bottom pb-3">
                  <h5 className="">Order {detail ? "# " + detail?.customOrderId : null}</h5>
                  <div className="d-flex align-items-center justify-content-center gap-2">
                    <Button className="d-flex align-items-center justify-content-center subscribe_btn" onClick={() => { navigate(ROUTES.MY_ORDERS) }}>Back</Button>
                    {cancelStates.includes(detail?.orderStatus) ? <Button className="d-flex align-items-center justify-content-center subscribe_btn">Cancel Order</Button> : null}
                  </div>
                </div>
              </Col>
              <Col lg="4" className="text-start mb-3">
                <p>Order Status : <strong>{detail?.orderStatus?.toUpperCase()}</strong></p>
              </Col>
              <Col lg="4" className="text-start mb-3">
                <p>{moment(detail.date_created).format("MMMM DD, YYYY")}</p>
              </Col>

              <Col lg="12" className="text-start py-2 bg-body-secondary d-flex justify-content-between align-items-center rounded">
                <strong>Items Ordered</strong>
                <Button className="btn-link">Invoice</Button>
              </Col>

              <Col lg="12" className="text-start my-3">
                <div className="wrapping_list_order table-responsive">
                  <Table className="fs-base order-table">
                    <tbody>
                      <tr>
                        <th>Product Name</th>
                        <th style={{ minWidth: "150px" }}>Price</th>
                        <th className="text-end">Qty</th>
                        <th className="text-end" style={{ minWidth: "150px" }}>Subtotal</th>
                      </tr>
                    </tbody>
                    <tbody>
                      {detail.line_items?.map((item, key) => (
                        <tr key={key}>
                          <td>
                            <strong>{item.productName}</strong>
                            {item?.attributes?.length ? (<p className="mb-0 fs-base">{item?.attributes?.map(attr => attr.attrName + ": " + attr.attrValue).join(" | ")}</p>) : null}
                          </td>
                          <td className="text-primary fw-bolder">{detail?.currency?.symbol || defaultExchangeRate.symbol} {formatNumber(item.unitPrice)}</td>
                          <td className="text-end">{formatNumber(item.quantity)}</td>
                          <td className="text-primary fw-bolder text-end">{detail?.currency?.symbol || defaultExchangeRate.symbol} {formatNumber(item.amount)}</td>
                        </tr>
                      ))}

                      <tr className="order-detail-tr">
                        <td colSpan={3} className="py-0">
                          <strong>Sub Total</strong>
                        </td>
                        <td className="text-primary py-0 fw-bolder">{detail?.currency?.symbol || defaultExchangeRate.symbol} {formatNumber(detail.subTotal)}</td>
                      </tr>
                      <tr className="order-detail-tr">
                        <td colSpan={3} className="py-0">
                          <strong>Tax ({formatNumber(detail.taxAmount)}%)</strong>
                        </td>
                        <td className="text-primary py-0 fw-bolder">{detail?.currency?.symbol || defaultExchangeRate.symbol} {formatNumber(detail.tax)}</td>
                      </tr>
                      <tr className="order-detail-tr">
                        <td colSpan={3} className="py-0">
                          <strong>Delivery Fee</strong>
                        </td>
                        <td className="text-primary py-0 fw-bolder">{detail?.deliveryFee ? `${detail?.currency?.symbol || defaultExchangeRate.symbol} ${formatNumber(detail.deliveryFee)}` : <p className="text-success m-0">Free</p>}</td>
                      </tr>

                      {detail?.discountTotal ? <tr className="order-detail-tr">
                        <td colSpan={3} className="py-0">
                          <strong>Discount {detail?.coupon ? `(${detail.coupon.toUpperCase()})` : null}</strong>
                        </td>
                        <td className="text-primary py-0 fw-bolder">-{detail?.currency?.symbol || defaultExchangeRate.symbol} {formatNumber(detail.discountTotal)}</td>
                      </tr> : null}

                      <tr className="order-detail-tr">
                        <td colSpan={3} className="py-0">
                          <strong>Grand Total</strong>
                        </td>
                        <td className="text-primary py-0 fw-bolder">{detail?.currency?.symbol || defaultExchangeRate.symbol} {formatNumber(detail.orderTotal)}</td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              </Col>

              <Col lg="12" className="text-start mt-2 mb-4 py-2 bg-body-secondary d-flex justify-content-between align-items-center rounded">
                <strong>Order Information</strong>

              </Col>

              <Col lg={4} className="text-start">
                <strong>Shipping Address</strong>
                <RenderAddress className="mt-2" address={detail.shippingDetails} />
              </Col>
              <Col lg={4} className="text-start">
                <strong>Billing Address</strong>
                <RenderAddress className="mt-2" address={detail.billingDetails} />
              </Col>
              <Col lg={4} className="text-start">
                <strong>Payment Method</strong>
                <p className="mt-2">Cash on delivery</p>
              </Col>
            </>
          ) : isLoading ? <LoadingContent /> : <NoRecordFound />}

        </Row>
      </Container>
    </section>
  );
};

export default OrderDetailPage;
