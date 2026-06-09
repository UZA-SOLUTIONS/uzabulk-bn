import { useEffect, useRef, useState } from "react";
export default function ResendOtp({ callback }) {
    const [seconds, setSeconds] = useState(59);
    const timeoutRef = useRef(null);

    const runTimer = () => {
        clearInterval(timeoutRef?.current);
        timeoutRef.current = setInterval(() => {
            if (seconds === 0) {
                clearInterval(timeoutRef?.current)
            }
            else {
                setSeconds(s => s - 1);
            }
        }, 1000);
    }


    useEffect(() => {
        runTimer();

        return () => {
            clearInterval(timeoutRef?.current);
        }
    }, []);
    if (seconds > 0)
        return (
            <div className="w-100 text-end text-danger">
                Resend OTP in {seconds} second{seconds > 1 ? "s" : ""}
            </div>
        );

    return (
        <div className="w-100 text-end text-danger">
            <p className="cursor-pointer my-0 text-decoration-underline text-theme-primary underline" onClick={() => {
                setSeconds(59);
                runTimer();
                callback();
            }}>Resend OTP</p>
        </div>
    );
}