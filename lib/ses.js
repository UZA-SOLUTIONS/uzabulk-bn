const nodemailer = require('nodemailer');
async function sendEmail(to, sub, msg, attachments = []) {

    const options = {
        from: `"UZA" <${env.SMTP.EMAIL_SOURCE}>`,
        to: to,
        subject: sub,
        html: msg,
    };

    var transporter = createTransport();
    const info = await transporter.sendMail(options);
    return info;
};

function createTransport() {
    const smtpUser = String(env.SMTP.USERNAME || "").trim();
    const smtpPass = String(env.SMTP.PASSWORD || "").replace(/\s+/g, "");
    return nodemailer.createTransport({
        host: String(env.SMTP.HOST || "").trim(),
        port: 465,
        secure: true, // use SSL
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });
};

module.exports = { sendEmail };