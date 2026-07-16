const nodemailer = require("nodemailer");
const { applyEmailCopyrightYear } = require("./emailCopyright");

async function sendEmail(to, sub, msg, attachments = []) {
  const options = {
    from: `"UZA Bulk" <${env.SMTP.EMAIL_SOURCE}>`,
    to: to,
    subject: sub,
    html: applyEmailCopyrightYear(msg),
  };

  if (attachments?.length) {
    options.attachments = attachments;
  }

  const transporter = createTransport();
  const info = await transporter.sendMail(options);
  return info;
}

function createTransport() {
  const smtpUser = String(env.SMTP.USERNAME || "").trim();
  const smtpPass = String(env.SMTP.PASSWORD || "").replace(/\s+/g, "");
  const port = Number(env.SMTP.PORT || 587);
  const secure = Boolean(env.SMTP.SECURE);

  return nodemailer.createTransport({
    host: String(env.SMTP.HOST || "").trim(),
    port,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

module.exports = { sendEmail };
