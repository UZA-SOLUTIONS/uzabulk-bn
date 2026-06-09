export default function NoRecordFound({ message = "No Record Found!" }) {
  return (
    <>
      <div className="no-record-found-content">
        <p>{message}
          {/* <span className="fw-bolder text-danger">404</span> */}
        </p>
      </div>
    </>
  );
}
