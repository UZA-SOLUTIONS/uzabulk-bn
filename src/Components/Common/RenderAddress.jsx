export default function RenderAddress({ address, joinWith = ", ", className = "", style = { lineHeight: "1.7rem" } }) {

    if (!address) return null;

    const renderArray = (array) => {
        let newArray = [];
        array.forEach((value) => {
            if (!!value) {
                newArray.push(value);
            }
        });

        return newArray;
    }


    return (
        <>
            <p style={style} className={className}>
                {renderArray([address?.name, `${address?.countryCode} ${address?.mobileNumber}`.trim(), address?.area, address?.houseNo, address?.landmark, address?.address]).join(joinWith)}
            </p>
        </>
    );
}