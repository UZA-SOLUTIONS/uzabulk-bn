import { Spinner } from "react-bootstrap";

export default function BlockContent() {
  return (
    <>
      <div className="block-content">
        <Spinner role="status" size={"lg"} animation="grow">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    </>
  );
}
