import { Col, Container, Row } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";

import ChangeProfile from "./ChangeProfile";
import ChangeMobileNumber from "./ChangeMobileNumber";
import ChangeEmail from "./ChangeEmail";
import LoadingContent from "../../Components/Common/LoadingContent";
import NoRecordFound from "../../Components/Common/NoRecordFound";

import { APP_NAME } from "../../config/constants";
import { apiGetProfile } from "../../store/auth/actions";
import { clearUserProfile } from "../../store/auth/slice";

const ProfilePage = () => {
  const dispatch = useDispatch();
  const { isLoading, profile } = useSelector((s) => s.auth);

  const [changeMobileNumber, setChangeMobileNumber] = useState(false);
  const [changeEmailAddress, setChangeEmailAddress] = useState(false);

  const changeMobile = () => {
    setChangeMobileNumber(true);
    setChangeEmailAddress(false);
  };

  const changeEmail = () => {
    setChangeMobileNumber(false);
    setChangeEmailAddress(true);
  };

  const changeProfile = () => {
    setChangeMobileNumber(false);
    setChangeEmailAddress(false);
  };

  useEffect(() => {
    dispatch(apiGetProfile());

    return () => {
      dispatch(clearUserProfile());
    };
  }, []);
  return (
    <section className="profile_view bg-white px-3 pt-4 pb-2 rounded">
      <Helmet>
        <title>{APP_NAME} | Proifle</title>
      </Helmet>
      <Container>
        <Row>
          {profile ? (
            <>
              <Col lg="12" className="text-start mb-3">
                <h4>Account</h4>
              </Col>
              {changeMobileNumber ? (
                <ChangeMobileNumber changeProfile={changeProfile} />
              ) : changeEmailAddress ? (
                <ChangeEmail changeProfile={changeProfile} />
              ) : (
                <ChangeProfile
                  changeMobile={changeMobile}
                  changeEmail={changeEmail}
                />
              )}
            </>
          ) : isLoading ? (
            <LoadingContent />
          ) : (
            <NoRecordFound />
          )}
        </Row>
      </Container>
    </section>
  );
};

export default ProfilePage;
