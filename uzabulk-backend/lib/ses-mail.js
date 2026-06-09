const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

var client = new SESClient({
    region: env.AWS_SES.REGION_NAME,
    credentials: {
        accessKeyId: env.AWS_SES.ACCESS_ID,
        secretAccessKey: env.AWS_SES.SECRET_KEY,
    }
});

module.exports.sendEmail = async (to, subject, message) => {
    return new Promise(async (resolve, reject) => {
        try {
            const sendEmailParams = {
                Source: env.AWS_SES.EMAIL_SOURCE,
                Destination: {
                    ToAddresses: [to],
                },
                Message: {
                    Body: {
                        Html: {
                            Data: message,
                        },
                    },
                    Subject: {
                        Data: subject,
                    },
                },
            };
            const sendEmailCommand = new SendEmailCommand(sendEmailParams);
            client.send(sendEmailCommand)
                .then((data) => {
                    console.log("Email sent successfully: ", data.MessageId);
                    return resolve(data);
                })
                .catch((error) => {
                    console.error("Error sending email: ", error);
                    return resolve(error);
                });
        }
        catch (err) {
            console.log("Error sending email:", err);
            return reject(err);
        }
    });
}