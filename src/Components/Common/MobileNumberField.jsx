import { useEffect, useState } from "react";
import { ErrorMessage } from "formik";
import PhoneInput from "react-phone-input-2";

/** National significant number length (E.164-style); many countries are 8–15 digits. */
const MIN_NATIONAL_DIGITS = 8;
const MAX_NATIONAL_DIGITS = 15;

export const MobileError = ({
  value = "",
  name = "mobileNumber",
  minLength = MIN_NATIONAL_DIGITS,
}) => {
  if (!value) return null;
  return value?.length >= minLength ? null : (
    <ErrorMessage name={name} className="text-danger" component={"p"} />
  );
};

function nationalFromValue(value, dialCode) {
  const dial = String(dialCode || "").replace(/\D/g, "");
  const digits = String(value || "").replace(/\D/g, "");
  if (!dial) return digits;
  if (digits.startsWith(dial)) return digits.slice(dial.length);
  return digits;
}

export default function MobileNumberField({
  defaultValue = "",
  callback = () => {},
  className = "",
  inputClass = "",
  placeholder = "Phone number",
  inputProps: extraInputProps = {},
}) {
  const [fieldValue, setFieldValue] = useState("");

  useEffect(() => {
    if (!!defaultValue) {
      setFieldValue(`${(defaultValue || "")?.replace("+", "")}`);
    }
  }, [defaultValue]);

  const pushToForm = (value, data) => {
    const dial = data?.dialCode != null ? String(data.dialCode) : "1";
    const national = nationalFromValue(value, dial);
    callback(`+${dial.replace(/\D/g, "")}`, national.replace(/\D/g, ""));
  };

  return (
    <PhoneInput
      country={"us"}
      value={fieldValue}
      inputProps={{ placeholder, ...extraInputProps }}
      inputClass={inputClass}
      className={className}
      onMount={(value, data) => {
        const digits = String(value || "").replace(/\D/g, "");
        if (digits.length) pushToForm(value, data);
      }}
      onChange={(value, data) => {
        setFieldValue(value);
        pushToForm(value, data);
      }}
    />
  );
}
