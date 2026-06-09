import React from "react";
import { NavLink } from "react-router-dom";
import { Container } from "react-bootstrap";

const Categoriesstrip = () => {
  return (
    <div className="catgories_strip">
      <Container>
        <div className="inner_catwrap">
          <ul className="categories_list m-0 p-0 d-flex align-items-center">
            <li>
              <NavLink to="/all-categories">
                {" "}
                <span>{threebar}</span> All Categories
              </NavLink>
            </li>
          </ul>

          <ul className="categories_list m-0 p-0 d-flex align-items-center">
            <li>
              <NavLink to="/all-categories">All Categories</NavLink>
            </li>
            <li>
              <NavLink to="/all-categories">All Categories</NavLink>
            </li>
          </ul>


          <ul className="categories_list m-0 p-0 d-flex align-items-center">
            <li>
              <NavLink to="/all-categories">All Categories</NavLink>
            </li>
            <li>
              <NavLink to="/all-categories">All Categories</NavLink>
            </li>
            <li>
              <NavLink to="/all-categories">All Categories</NavLink>
            </li>
          </ul>
        </div>
      </Container>
    </div>
  );
};

export default Categoriesstrip;

// svg icon
const threebar = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 24 24"
  >
    <path
      fill="none"
      stroke="#000"
      strokeLinecap="round"
      strokeWidth="2"
      d="M5 6h14M5 12h14M5 18h14"
    />
  </svg>
);

const toprank = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 512 512"
  >
    <path
      fill="currentColor"
      d="M255 471L91.7 387V41h328.6v346zm-147.3-93.74L255 453l149.3-75.76V57H107.7zm187.61-168.34l-14.5-46l38.8-28.73l-48.27-.43L256 87.94l-15.33 45.78l-48.27.43l38.8 28.73l-14.5 46l39.31-28zM254.13 311.5l98.27-49.89v-49.9l-98.14 49.82l-94.66-48.69v50zm.13 32.66l-94.66-48.69v50l94.54 48.62l98.27-49.89v-49.9z"
    />
  </svg>
);
