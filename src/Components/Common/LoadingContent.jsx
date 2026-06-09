import { Spinner } from "react-bootstrap";

export default function LoadingContent({ style }) {
  return (
    <>
      <div className="loading-content">
        <Spinner animation="border" role="status" size={"lg"} style={style}>
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    </>
  );
}
