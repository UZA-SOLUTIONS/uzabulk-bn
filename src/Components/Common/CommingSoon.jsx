export default function CommingSoon({ message }) {
    return (
        <>
            <div className="no-record-found-content">
                <p>{message || "No Product found!"}</p>
            </div>
        </>
    );
}
