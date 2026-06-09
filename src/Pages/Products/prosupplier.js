import React from "react";
import Slider from "react-slick";

// images
import categorieone from "../../assets/images/Decor.webp";
import Customone from "../../assets/images/custom1.webp";
import Customtwo from "../../assets/images/custom2.webp";
import Customthree from "../../assets/images/custom3.webp";

const verifieddata = [
  {
    id: 1,
    bg: Customone,
    verify : "Verify Pro X BLUEING",
    leadingtext : "Leading OEM for laptops",
    imgproone: categorieone,
    imgprotwo: categorieone,
  },
  {
    id: 2,
    bg: Customtwo,
    verify : "Verify Pro X BLUEING",
    leadingtext : "Leader in the touch PC industry",
    imgproone: categorieone,
    imgprotwo: categorieone,
  },
  {
    id: 3,
    bg: Customthree,
    verify : "Verify Pro X BLUEING",
    leadingtext : "All-in-one home theator solution provided",
    imgproone: categorieone,
    imgprotwo: categorieone,
  },
  {
    id: 4,
    bg: Customone,
    verify : "Verify Pro X BLUEING",
    leadingtext : "All-in-one home theator solution provided",
    imgproone: categorieone,
    imgprotwo: categorieone,
  },
  {
    id: 5,
    bg: Customtwo,
    verify : "Verify Pro X BLUEING",
    leadingtext : "Leader in the touch PC industry",
    imgproone: categorieone,
    imgprotwo: categorieone,
  },
  {
    id: 6,
    bg: Customthree,
    verify : "Verify Pro X BLUEING",
    leadingtext : "Leading OEM for laptops",
    imgproone: categorieone,
    imgprotwo: categorieone,
  },
];

function SampleNextArrow(props) {
  const { className, style, onClick } = props;
  return (
    <div className={className} style={{ ...style }} onClick={onClick}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 24 24"
      >
        <path
          fill="#233448"
          d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z"
        />
      </svg>
    </div>
  );
}

function SamplePrevArrow(props) {
  const { className, style, onClick } = props;
  return (
    <div className={className} style={{ ...style }} onClick={onClick}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 24 24"
      >
        <path
          fill="#233448"
          d="m9.55 12l7.35 7.35q.375.375.363.875t-.388.875t-.875.375t-.875-.375l-7.7-7.675q-.3-.3-.45-.675t-.15-.75t.15-.75t.45-.675l7.7-7.7q.375-.375.888-.363t.887.388t.375.875t-.375.875z"
        />
      </svg>
    </div>
  );
}

const Prosupplier = () => {
  const settings = {
    dots: false,
    infinite: true,
    speed: 500,
    autoplay: true,
    slidesToShow: 3,
    slidesToScroll: 1,
    nextArrow: <SampleNextArrow />,
    prevArrow: <SamplePrevArrow />,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll:1,
        }
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]
  };
  return (
    <section className="verified_suppiler">
      <h4 className="black_heading_top text-start">Verified Pro Supplier</h4>

      <div className="innner_verify_categories">
        <Slider {...settings}>
          {verifieddata?.map((item, idx) => {
            return (
              <div className="" key={idx}>
                <div
                  className="verified_card position-relative"
                  style={{ backgroundImage: `url(${item?.bg})` }}
                >
                  <div className="card_overlay"></div>

                  <div className="verifiedcard_content">
                      
                      <div className="blue_gradient">
                         {item?.verify}    
                      </div>

                      <p className="leading_text text-white text-start">{item?.leadingtext}</p>


                      <div className="white_boxes d-flex align-items-center gap-3">
                          <div className="column_boxes">
                              <img src={item?.imgproone} alt="" className="img-fluid"/>
                          </div>
                          <div className="column_boxes">
                          <img src={item?.imgprotwo} alt="" className="img-fluid"/>
                          </div>
                      </div>

                  </div>
                </div>
              </div>
            );
          })}
        </Slider>
      </div>
    </section>
  );
};

export default Prosupplier;
