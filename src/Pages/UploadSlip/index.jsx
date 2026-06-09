import React, { useCallback, useEffect, useState } from "react";
import { Container, Row, Col, Button } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Dropzone from 'react-dropzone';

import { formatNumber, logger } from "../../helpers/commonHelper";
import ROUTES from "../../helpers/routesHelper";

// images
import { defaultExchangeRate } from "../../config/constants";
import apiClient from "../../helpers/apiHelper";
import { ORDER, FILE } from "../../helpers/urlHelper";
import AbsoluteLoader from "../../Components/Common/AbsoluteLoader";
import { toast } from "react-toastify";
import { ICON_PDF } from "../../assets/svg";

const UploadSlip = () => {
  const [order, setOrder] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [slipUploaded, setSlipUploaded] = useState(false);
  const [message, setMessage] = useState("");
  const [submessage, setSubMessage] = useState("");
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const calculateTotalAmount = (orders) => {
    if (!!orders) {
      logger(orders);
      return orders?.reduce((total, order) => total + order.orderTotal, 0);
    } else {
      return 0;
    }
  };

  const fetchOrderDetails = useCallback(async () => {
    setIsLoading(true);
    const res = await apiClient.get(ORDER.CHECK_SLIP_STATUS, {
      params: {
        data: search.get("data"),
      }
    });

    if (res.status === "success") {
      setOrder(res.data);
      setSlipUploaded(res.data[0]?.slipUploadStatus === "uploaded");
      setFileUrl(res.data[0]?.slipLink || "");
    }

    setIsLoading(false);
    setMessage(res.data[0]?.slipUploadStatus === "uploaded" ? "Slip already uploaded" : "Upload payment slip");
    setSubMessage(res.data[0]?.slipUploadStatus === "uploaded" ? "You have already uploaded payment slip for this order" : "Please pay and upload payment slip here.");
  }, [search]);

  const updateOrderSlip = async (fileUrl) => {
    const res = await apiClient.post(ORDER.UPLOAD_SLIP, {
      data: search.get("data"),
      slipLink: fileUrl
    });

    if (res.status === "success") {
      setMessage("Slip upload successfully!");
      setSubMessage("Your payment slip has been uploaded, Thank you for your order!");
      setIsFileUploaded(false);
    }

  }

  const handleFileUpload = async (acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length === 1) {
      setIsUploading(true);
      const formData = new FormData();

      // Use acceptedFiles[0] directly, with the correct key
      formData.append("file", acceptedFiles[0]);

      try {
        const res = await apiClient.post(FILE.ADD, formData, {
          headers: {
            'Content-Type': 'multipart/form-data', // Ensure correct content type
          },
        });

        // Check if the response is successful
        if (res.status === "success") {
          setFileUrl(res.data?.link);
          setIsFileUploaded(true);
        } else {
          toast.error(res.message || "Something went wrong, please try again later.");
        }
      } catch (error) {
        toast.error("An error occurred while uploading the file. Please try again.");
        console.error("Upload error:", error);
      } finally {
        setIsUploading(false);
      }
    } else {
      toast.warning("Please select a single slip with JPG, PNG, or PDF format.");
    }
  };

  useEffect(() => {
    if (!search.get("data")) {
      navigate(ROUTES.HOME);
    }
    else {
      fetchOrderDetails();
    }
  }, [search, navigate, fetchOrderDetails]);

  return (
    <section className="upload_slip_page">
      <Helmet>
        <title>Order payment slip</title>
      </Helmet>
      <Container>
        <Row className="position-relative" style={{ minHeight: "40vh" }}>
          {isLoading ?
            <AbsoluteLoader className={"bg-white"} /> :
            (
              <>
                <Col lg={6} md={6} sm={12}>
                  <center>
                    <div className="consgratulation_Content">
                      <h4>{message}</h4>

                      <p>{submessage}</p>

                      <hr />

                      <h3>
                        Total amount : {order[0]?.currency?.symbol || defaultExchangeRate?.symbol} {formatNumber(calculateTotalAmount(order))}
                      </h3>
                      {order?.map((order, key) => {
                        return <p key={key} className="fs-6 m-0 p-0">
                          Order ID : {order.customOrderId}
                        </p>
                      })}
                    </div>
                  </center>
                </Col>

                <Col lg={6} md={6} sm={12}>

                  <>
                    <center>
                      <div className="consgratulation_Content">

                        <div className="position-relative">
                          {isUploading ? <AbsoluteLoader /> : null}
                          {!fileUrl && !slipUploaded ? (
                            <Dropzone onDrop={handleFileUpload}
                              accept={{
                                'application/pdf': [],  // Accept PDF files
                                'image/png': [],         // Accept PNG files
                                'image/jpeg': [],        // Accept JPG files
                              }}
                              maxFiles={1}>
                              {({ getRootProps, getInputProps }) => (
                                <section className="drop-zone-fileupload mt-3 py-5">
                                  <div {...getRootProps()}>
                                    <input {...getInputProps()} />
                                    <p className="text-black mb-0 fs-base">Drag 'n' drop some files here, or click to select files</p>
                                  </div>
                                </section>
                              )}
                            </Dropzone>
                          ) : fileUrl ? (
                            <>
                              <div className="my-3">
                                {((fileUrl?.split(".")).at(-1))?.toLowerCase() === "pdf" ? (
                                  <div className="d-flex flex-column text-center cursor-pointer">
                                    <Link
                                      to={fileUrl}
                                      download
                                      target="_blank"
                                      className="text-decoration-none"
                                    >
                                      <span>
                                        {ICON_PDF()}
                                        <p className="mb-0 mt-1 text-black fs-base">
                                          Download slip: {((fileUrl?.split("/")).at(-1))}
                                        </p>
                                      </span>
                                    </Link>
                                  </div>
                                ) : (
                                  <div className="d-flex flex-column align-items-center gap-3 cursor-pointer">
                                    <img src={fileUrl} key={fileUrl} width={200} alt="Uploaded content" />
                                    <Link
                                      to={fileUrl}
                                      download
                                      target="_blank"
                                      className="text-decoration-none"
                                    >
                                      <p className="mb-0 mt-1 text-black fs-base">
                                        Download slip: {((fileUrl?.split("/")).at(-1))}
                                      </p>
                                    </Link>
                                  </div>
                                )}
                              </div>

                              {isFileUploaded ? <>
                                <Button className="btn btn-secondary me-2" onClick={() => {
                                  setIsFileUploaded(false);
                                  setFileUrl("");
                                  setSlipUploaded(false);
                                }}>Clear</Button>
                                <Button className="subscribe_btn btn btn-secondary" onClick={() => updateOrderSlip(fileUrl)}>Submit</Button>
                              </> : null}
                            </>

                          ) : null}
                        </div>
                      </div>
                    </center>
                  </>
                </Col>
              </>
            )}
        </Row>
      </Container>
    </section>
  );
};

export default UploadSlip;
