import React from "react";
import { Col, Container, Row } from "react-bootstrap";

// images
import Bigimage from "../../assets/images/homeimg.png";



const Streamline = () => {
  return (
    <section className="stream_line_ordering py-3">
      <Container>
        <div className="inner_strem py-4">
          <h3 className="common_head my-3 pb-2 text-start">
            Stremline ordering from search to fullfillment , all in one place
          </h3>

          <div className="stremlnie-column">
            <Row>
              <Col lg={6} md={6} sm={12}>
                <div className="stremline_left text-start position-relative">
                  <ul>
                    <li>
                      <div className="d-flex align-items-center position-relative">
                        <div className="strem_iconshow me-3">{searchicon}</div>
                        <div className="strem_line_content active_one">
                          <h4>Search for matches</h4>
                          <p>
                            Lorem ipsum dolor sit amet consectetur adipisicing
                            elit. Provident, ducimus!s
                          </p>
                        </div>
                      </div>
                    </li>

                    <li>
                      <div className="d-flex align-items-center position-relative">
                        <div className="strem_iconshow me-3">{verifyicon}</div>
                        <div className="strem_line_content">
                          <h4>Identify the right one</h4>
                        </div>
                      </div>
                    </li>

                    <li>
                      <div className="d-flex align-items-center position-relative">
                        <div className="strem_iconshow me-3">{swappicon}</div>
                        <div className="strem_line_content">
                          <h4>Pay with confidence</h4>
                        </div>
                      </div>
                    </li>

                    <li>
                      <div className="d-flex align-items-center position-relative">
                        <div className="strem_iconshow me-3">{globeicon}</div>
                        <div className="strem_line_content">
                          <h4>Fullfill with transparency</h4>
                        </div>
                      </div>
                    </li>

                    <li>
                      <div className="d-flex align-items-center position-relative">
                        <div className="strem_iconshow me-3">{manageicon}</div>
                        <div className="strem_line_content">
                          <h4>Manage with ease</h4>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </Col>

              <Col lg={6} md={6} sm={12}>
                <div className="stremline_img">
                  <img src={Bigimage} alt="" className="img-fluid" />
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default Streamline;

// svg

const searchicon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 24 24"
  >
    <path
      fill="#974d00"
      d="m19.6 21l-6.3-6.3q-.75.6-1.725.95T9.5 16q-2.725 0-4.612-1.888T3 9.5t1.888-4.612T9.5 3t4.613 1.888T16 9.5q0 1.1-.35 2.075T14.7 13.3l6.3 6.3zM9.5 14q1.875 0 3.188-1.312T14 9.5t-1.312-3.187T9.5 5T6.313 6.313T5 9.5t1.313 3.188T9.5 14"
    />
  </svg>
);

const verifyicon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 24 24"
  >
    <path
      fill="#974d00"
      fill-rule="evenodd"
      d="M10.594 2.319a3.261 3.261 0 0 1 2.812 0c.387.185.74.487 1.231.905l.078.066c.238.203.313.265.389.316c.193.13.41.219.637.264c.09.018.187.027.499.051l.101.008c.642.051 1.106.088 1.51.23a3.27 3.27 0 0 1 1.99 1.99c.142.404.178.868.23 1.51l.008.101c.024.312.033.41.051.499c.045.228.135.445.264.638c.051.075.113.15.316.388l.066.078c.419.49.72.844.905 1.23c.425.89.425 1.924 0 2.813c-.184.387-.486.74-.905 1.231l-.066.078a4.758 4.758 0 0 0-.316.389c-.13.193-.219.41-.264.637c-.018.09-.026.187-.051.499l-.009.101c-.05.642-.087 1.106-.23 1.51a3.26 3.26 0 0 1-1.989 1.99c-.404.142-.868.178-1.51.23l-.101.008a4.757 4.757 0 0 0-.499.051a1.755 1.755 0 0 0-.637.264a4.83 4.83 0 0 0-.39.316l-.077.066c-.49.419-.844.72-1.23.905a3.261 3.261 0 0 1-2.813 0c-.387-.184-.74-.486-1.231-.905a95.175 95.175 0 0 0-.078-.066a4.779 4.779 0 0 0-.388-.316a1.746 1.746 0 0 0-.638-.264a4.759 4.759 0 0 0-.499-.051l-.101-.009c-.642-.05-1.106-.087-1.51-.23a3.261 3.261 0 0 1-1.99-1.989c-.142-.404-.179-.868-.23-1.51l-.008-.101a4.76 4.76 0 0 0-.051-.499a1.756 1.756 0 0 0-.264-.637a4.74 4.74 0 0 0-.316-.39l-.066-.077c-.418-.49-.72-.844-.905-1.23a3.261 3.261 0 0 1 0-2.813c.185-.387.487-.74.905-1.231l.066-.078a4.76 4.76 0 0 0 .316-.388c.13-.193.219-.41.264-.638c.018-.09.027-.187.051-.499l.008-.101c.051-.642.088-1.106.23-1.51a3.261 3.261 0 0 1 1.99-1.99c.404-.142.868-.179 1.51-.23l.101-.008a4.47 4.47 0 0 0 .499-.051c.228-.045.445-.135.638-.264c.075-.051.15-.113.388-.316l.078-.066c.49-.418.844-.72 1.23-.905m2.163 1.358a1.756 1.756 0 0 0-1.514 0c-.185.088-.38.247-.981.758l-.03.025c-.197.168-.34.291-.497.396c-.359.24-.761.407-1.185.49c-.185.037-.373.052-.632.073l-.038.003c-.787.063-1.036.089-1.23.157c-.5.177-.894.57-1.07 1.071c-.07.194-.095.443-.158 1.23l-.003.038c-.02.259-.036.447-.072.632c-.084.424-.25.826-.49 1.185c-.106.157-.229.3-.397.498l-.025.029c-.511.6-.67.796-.758.98a1.756 1.756 0 0 0 0 1.515c.088.185.247.38.758.981l.025.03c.168.197.291.34.396.497c.24.359.407.761.49 1.185c.037.185.052.373.073.632l.003.038c.063.787.089 1.036.157 1.23c.177.5.57.894 1.071 1.07c.194.07.443.095 1.23.158l.038.003c.259.02.447.036.632.072c.424.084.826.25 1.185.49c.157.106.3.229.498.397l.029.025c.6.511.796.67.98.758a1.756 1.756 0 0 0 1.515 0c.185-.088.38-.247.981-.758l.03-.025c.197-.168.34-.291.497-.396c.359-.24.761-.407 1.185-.49a5.53 5.53 0 0 1 .632-.073l.038-.003c.787-.063 1.036-.089 1.23-.157c.5-.177.894-.57 1.07-1.071c.07-.194.095-.444.158-1.23l.003-.038a5.53 5.53 0 0 1 .072-.633c.084-.423.25-.825.49-1.184c.106-.157.229-.3.397-.498l.025-.029c.511-.6.67-.796.758-.98a1.756 1.756 0 0 0 0-1.515c-.088-.185-.247-.38-.758-.981l-.025-.03c-.168-.197-.291-.34-.396-.497a3.262 3.262 0 0 1-.49-1.185a5.531 5.531 0 0 1-.073-.632l-.003-.038c-.063-.787-.089-1.036-.157-1.23c-.177-.5-.57-.894-1.071-1.07c-.194-.07-.444-.095-1.23-.158l-.038-.003a5.568 5.568 0 0 1-.633-.072a3.262 3.262 0 0 1-1.184-.49c-.157-.106-.3-.229-.498-.397l-.029-.025c-.6-.511-.796-.67-.98-.758m3.287 5.282a.752.752 0 0 1 0 1.065l-5.017 5.017a.753.753 0 0 1-1.064 0l-2.007-2.007A.753.753 0 1 1 9.02 11.97l1.475 1.474L14.98 8.96a.753.753 0 0 1 1.064 0"
      clip-rule="evenodd"
    />
  </svg>
);

const swappicon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 24 24"
  >
    <path
      fill="#974d00"
      d="M12.005 22.003c-5.523 0-10-4.477-10-10s4.477-10 10-10s10 4.477 10 10s-4.477 10-10 10m0-2a8 8 0 1 0 0-16a8 8 0 0 0 0 16m-5-11l3-3.5l3 3.5h-2v4h-2v-4zm10 6l-3 3.5l-3-3.5h2v-4h2v4z"
    />
  </svg>
);

const globeicon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 36 36"
  >
    <path
      fill="#974d00"
      d="M33.12 12.81a7.44 7.44 0 0 1-1.91.58a14.05 14.05 0 1 1-8.6-8.6a7.43 7.43 0 0 1 .58-1.91a16.06 16.06 0 1 0 9.93 9.93"
      className="clr-i-outline--badged clr-i-outline-path-1--badged"
    />
    <path
      fill="#974d00"
      d="M20.25 5.77a17.83 17.83 0 0 1 3.89 6.59h-5.39V5.6h-1.5v6.77h-5.39a17.83 17.83 0 0 1 3.9-6.6a12.28 12.28 0 0 0-2.54.75a19.72 19.72 0 0 0-2.91 5.85H6.94A12.3 12.3 0 0 0 6.26 14h3.63a19.38 19.38 0 0 0-.43 4a19.67 19.67 0 0 0 .5 4.37H6.42A12.34 12.34 0 0 0 7.16 24h3.23a19.32 19.32 0 0 0 2.69 5.36a12.28 12.28 0 0 0 2.61.79A17.91 17.91 0 0 1 12 24h5.26v6.34h1.5V24H24a17.9 17.9 0 0 1-3.7 6.15a12.28 12.28 0 0 0 2.62-.81A19.32 19.32 0 0 0 25.61 24h3.2a12.34 12.34 0 0 0 .74-1.6H26a19.67 19.67 0 0 0 .5-4.37a19.38 19.38 0 0 0-.43-4h3.6c-.06-.17-.12-.33-.19-.49a7.45 7.45 0 0 1-3.47-1.11h-.36c0-.11-.08-.21-.11-.32a7.48 7.48 0 0 1-3.06-5.62a12.41 12.41 0 0 0-2.23-.72m-3 16.59h-5.74a17.69 17.69 0 0 1-.09-8.4h5.83ZM25 18a18.12 18.12 0 0 1-.55 4.37h-5.7V14h5.83a18.21 18.21 0 0 1 .42 4"
      className="clr-i-outline--badged clr-i-outline-path-2--badged"
    />
    <circle
      cx="30"
      cy="6"
      r="5"
      fill="#974d00"
      className="clr-i-outline--badged clr-i-outline-path-3--badged clr-i-badge"
    />
    <path fill="none" d="M0 0h36v36H0z" />
  </svg>
);

const manageicon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 24 24"
  >
    <path
      fill="#974d00"
      d="m16 21l-.3-1.5q-.3-.125-.562-.262T14.6 18.9l-1.45.45l-1-1.7l1.15-1q-.05-.35-.05-.65t.05-.65l-1.15-1l1-1.7l1.45.45q.275-.2.538-.337t.562-.263L16 11h2l.3 1.5q.3.125.563.275t.537.375l1.45-.5l1 1.75l-1.15 1q.05.3.05.625t-.05.625l1.15 1l-1 1.7l-1.45-.45q-.275.2-.537.338t-.563.262L18 21zM2 20v-2.8q0-.825.425-1.55t1.175-1.1q1.275-.65 2.875-1.1T10 13h.35q.15 0 .3.05q-.725 1.8-.6 3.575T11.25 20zm15-2q.825 0 1.413-.587T19 16t-.587-1.412T17 14t-1.412.588T15 16t.588 1.413T17 18m-7-6q-1.65 0-2.825-1.175T6 8t1.175-2.825T10 4t2.825 1.175T14 8t-1.175 2.825T10 12"
    />
  </svg>
);
