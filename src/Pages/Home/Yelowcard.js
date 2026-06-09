import React from "react";
import { Col, Container, Row } from "react-bootstrap";



// svg
const millions = <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 14 14"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="7" x="8.5" y="6.5" rx=".5"/><rect width="5" height="3.01" x="8.5" y=".5" rx=".5"/><rect width="5" height="7" x=".5" y=".5" rx=".5"/><rect width="5" height="3.01" x=".5" y="10.49" rx=".5"/></g></svg>


const secure = <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path fill="currentColor" d="m11.19 1.36l-7 3.11C3.47 4.79 3 5.51 3 6.3V11c0 5.55 3.84 10.74 9 12c5.16-1.26 9-6.45 9-12V6.3c0-.79-.47-1.51-1.19-1.83l-7-3.11c-.51-.23-1.11-.23-1.62 0M12 11.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11z"/></svg>


const stepbox = <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path fill="currentColor" d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.2 0 .375.038t.35.112L17.875 5H5v14h14v-6.65l2-2V19q0 .825-.587 1.413T19 21zm6.525-4l-5.65-5.65l1.4-1.4l4.25 4.25L20.7 5.025L22.125 6.4z"/></svg>


const trailtrade = <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path fill="currentColor" d="M7.624 4.449C9.501 3.698 10.621 3.25 12 3.25c1.38 0 2.499.448 4.376 1.199l2.97 1.188c.954.382 1.727.69 2.258.969c.268.14.528.3.729.493c.206.198.417.498.417.901s-.21.703-.417.901c-.2.193-.46.352-.73.493c-.53.278-1.303.587-2.258.97l-2.97 1.187C14.5 12.302 13.38 12.75 12 12.75s-2.499-.448-4.376-1.199l-2.969-1.188c-.955-.382-1.728-.69-2.259-.969a3.21 3.21 0 0 1-.729-.493C1.461 8.703 1.25 8.403 1.25 8s.21-.703.417-.901c.2-.193.46-.352.73-.493c.53-.278 1.303-.587 2.258-.97z"/><path fill="currentColor" d="M2.502 11.443L2.5 11.44a.75.75 0 0 0-1 1.119L2 12l-.5.559l.002.002l.005.004l.014.012c.01.01.026.023.045.039a9.092 9.092 0 0 0 .77.558c.534.346 1.321.79 2.364 1.207l2.809 1.124l.115.046c1.877.751 2.997 1.199 4.376 1.199c1.38 0 2.499-.448 4.375-1.199l.116-.046L19.3 14.38a13.715 13.715 0 0 0 2.363-1.207a9.09 9.09 0 0 0 .771-.558l.045-.039l.014-.012l.005-.004l.001-.002h.002a.75.75 0 0 0-1-1.119l-.002.002l-.002.001l-.024.021l-.118.094a7.583 7.583 0 0 1-.508.357c-.46.299-1.161.697-2.105 1.074l-2.808 1.123c-2.025.81-2.874 1.138-3.934 1.138s-1.91-.328-3.934-1.138L5.257 12.99a12.224 12.224 0 0 1-2.104-1.074a7.569 7.569 0 0 1-.65-.472" opacity=".7"/><path fill="currentColor" d="M2.499 15.5a.75.75 0 0 0-1 1.118H1.5l.002.002l.005.004l.014.012c.01.01.026.023.045.039l.161.13c.14.107.343.255.61.428c.533.346 1.32.79 2.363 1.207l2.809 1.124l.115.046c1.877.751 2.997 1.2 4.376 1.2c1.38 0 2.499-.449 4.375-1.2l.116-.046L19.3 18.44a13.722 13.722 0 0 0 2.363-1.208a9.09 9.09 0 0 0 .771-.558a2.96 2.96 0 0 0 .045-.039l.014-.012l.005-.004l.001-.001l.002-.002a.75.75 0 0 0-1-1.118l-.002.002l-.002.001l-.024.021l-.118.094a7.583 7.583 0 0 1-.508.357c-.46.299-1.161.697-2.105 1.074l-2.808 1.123c-2.025.81-2.874 1.138-3.934 1.138s-1.91-.328-3.934-1.138l-2.809-1.123a12.231 12.231 0 0 1-2.104-1.073a7.569 7.569 0 0 1-.626-.452l-.025-.02z" opacity=".4"/></svg>


const carddata = [
  {
    cardicon: millions,
    cardhead: "Millions of business offerings",
    carddes:
      " Explore products and suppliers for your business from millions of offerings worldwide. ",
  },
  {
    cardicon: secure,
    cardhead: "Assured quality and transactions ",
    carddes:
      " Ensure production quality from verified suppliers, with your orders protected from payment to delivery. ",
  },
  {
    cardicon: stepbox,
    cardhead: "One-stop trading solution",
    carddes:
      "Order seamlessly from product/supplier search to order management, payment, and fulfillment. ",
  },
  {
    cardicon: trailtrade,
    cardhead: "Tailored trading experience ",
    carddes:
      "Get curated benefits, such as exclusive discounts, enhanced protection, and extra support, to help grow your business every step of the way. ",
  },
];

const Yelowcard = () => {
  return (
    <section className="yellow_card">
      <Container>
        <Row>
          {carddata?.map((item, idx) => {
            return (
              <Col lg={3} md={6} sm={12} key={idx}>
                <div className="common_card text-start">
                  <div className="cardicon">{item.cardicon}</div>
                  <h4>{item.cardhead}</h4>
                  <p>{item.carddes}</p>
                </div>
              </Col>
            );
          })}
        </Row>
      </Container>
    </section>
  );
};

export default Yelowcard;




