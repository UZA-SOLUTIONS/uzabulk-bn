import { Spinner } from "react-bootstrap";

export default function AbsoluteLoader({ className }) {
    return (
        <div className={`position-absolute p-5 rounded ${className}`} style={{
            width: "100%",
            height: "100%",
            background: "#c7c2c278",
            zIndex: 9
        }}>
            <div style={{
                // left: "50%", top: "50%", transform: "translate(-50%, -50%)" 
                margin: "auto",
                // marginTop: "100px",
            }} className="text-center">
                <Spinner />
            </div>
        </div>
    );
}