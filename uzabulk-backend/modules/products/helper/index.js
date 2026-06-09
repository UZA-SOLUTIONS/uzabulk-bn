let roundNumber = (num) => {
    return Math.round(num * 100) / 100;
};
let toFixedNumber = (num) => {
    return Number(num.toFixed(2));
}
let generatorRandomNumber = (length) => {

    if (typeof length == "undefined")
        length = 2;
    var token = "";
    var possible = "123456789";
    for (var i = 0; i < length; i++)
        token += possible.charAt(Math.floor(Math.random() * possible.length));
    return token;
}

module.exports = {
    roundNumber,
    toFixedNumber,
    generatorRandomNumber,
};
