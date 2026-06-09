import { useEffect, useState } from "react";

export default function TempErrorMessage({ message = "" }) {

    const [show, setShow] = useState(false);
    const handleMessageShow = () => {
        setShow(true);

        setTimeout(() => {
            setShow(false);
        }, 3000);
    }
    useEffect(() => {
        handleMessageShow();
    }, [message])

    if (show)
        return (
            <>
                <small className="fst-italic mb-0 text-danger">{message || ''}</small>
            </>
        );

    return null;
}