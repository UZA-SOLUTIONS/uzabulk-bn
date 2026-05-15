import React from "react";
import { Container } from "react-bootstrap";
import ItemCategory from "./Items/ItemCategory";
import UserAuthCard from "./UserAuthCard";

const Homemenustrip = ({ inline = false }) => {
  const Wrapper = inline ? React.Fragment : Container;
  const wrapperProps = inline
    ? {}
    : { fluid: true, className: "header-mockup-container px-3 px-sm-4 px-xl-5" };

  return (
    <div className="home_strip home_strip--mockup">
      <Wrapper {...wrapperProps}>
        <div className="header-mockup-bottom-row">
          <ul className="homeMenu_list homeMenu_list--mockup m-0 p-0 d-flex align-items-center">
            <ItemCategory catalogTrigger="grid" />
          </ul>
          <UserAuthCard navbarPlacement="mockupBottom" />
        </div>
      </Wrapper>
    </div>
  );
};

export default Homemenustrip;
