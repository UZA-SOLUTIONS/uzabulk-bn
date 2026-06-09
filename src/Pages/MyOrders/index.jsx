import React, { useEffect, useState } from "react";
import { Col, Container, Row, Table } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import moment from "moment";
import { Link } from "react-router-dom";
import Pagination from "../../Components/Common/Pagination";
import { APP_NAME, defaultExchangeRate } from "../../config/constants";
import { formatNumber, handlePageClick } from "../../helpers/commonHelper";
import { apiGetOrders } from "../../store/order/actions";
import ROUTES from "../../helpers/routesHelper";
import LoadingContent from "../../Components/Common/LoadingContent";
import apiClient from "../../helpers/apiHelper";
import { ORDER } from "../../helpers/urlHelper";
import { toast } from "react-toastify";

const MyOrdersPage = () => {
  const dispatch = useDispatch();
  const { currentCurrency } = useSelector(s => s.config);
  const { totalPages, isLoading, items } = useSelector((s) => s.order.orders);

  const [limit, setLimit] = useState(10);

  const handleUploadSlip = async (orderId) => {
    try {
      const res = await apiClient.get(ORDER.CREATE_SLIP_UPLOAD_LINK + "/" + orderId);
      if (res.status === "success") {
        window.open(res.data?.link, "_blank");
      }
      else {
        toast.error(res.message || "Something went wrong, please try again later.");
      }
    }
    catch (error) {
      toast.error(error?.message || "Something went wrong, please try again later.");
    }
  }

  const fetchRecords = (page = 1) => {
    dispatch(
      apiGetOrders({
        limit: limit,
        skip: page,
        order: "desc",
        orderBy: "date_created_utc"
      })
    );
  }

  useEffect(() => {
    fetchRecords();
  }, []);

  return (
    <section className="profile_view bg-white px-3 pt-4 pb-2 rounded">
      <Helmet>
        <title>{APP_NAME} | My Orders</title>
      </Helmet>
      <Container>
        <Row>
          <Col lg="12" className="text-start mb-3">
            <h4>My Orders</h4>
          </Col>

          <Col lg="12" className="text-start my-3">
            <div className="wrapping_list_order table-responsive position-relative">
              <Table className="fs-base order-table">
                <tbody>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Total Payable Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </tbody>
                <tbody>
                  {items?.length ? (
                    items.map((order, index) => {
                      return (
                        <tr key={index}>
                          <td>{order.customOrderId || order._id}</td>
                          <td>{moment(order.date_created).format("M/D/YY")}</td>
                          <td>{order?.currency?.symbol || defaultExchangeRate.symbol} {formatNumber(order.orderTotal)}</td>
                          <td>{order.orderStatus.toUpperCase()}</td>
                          <td>
                            <Link to={ROUTES.ORDER_DETAIL + "/" + order._id}>	View Order</Link>
                            {order?.slipUploadStatus !== "uploaded" ? (
                              <>
                                <span className="px-1">|</span>
                                <Link to={"#"} onClick={() => handleUploadSlip(order._id)}>	Upload Receipt</Link>
                              </>
                            ) : null}
                          </td>
                        </tr>

                      );
                    })
                  ) : isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center"><LoadingContent /></td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center">No Record Found!</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Col>

          <Col lg="12" className="text-start my-2 d-flex justify-content-between">
            <Pagination
              totalPages={totalPages}
              handlePageClick={handlePageClick({ fetchRecords })}
              key={`${limit}-${totalPages}`}
            />
            <div className="d-flex gap-3 align-items-center">
              <p className="mb-0">Items per page</p>
              <select className="form-control" style={{ width: "fit-content" }} onChange={(e) => {
                setLimit(parseInt(e.target.value));
                fetchRecords();
              }}>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default MyOrdersPage;
