import { Spinner } from "react-bootstrap";

export default function ButtonLoader({ size = 16 }) {
    return <Spinner size="sm" style={{ width: size, height: size }} />
}