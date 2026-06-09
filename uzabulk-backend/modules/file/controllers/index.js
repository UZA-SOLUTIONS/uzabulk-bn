module.exports = {
    addFileData: async (req, res) => {
        try {
            let data = req.body;

            const file = req.file;

            if (!file) {
                return res.error("IMAGE_IS_REQUIRED");
            };

            if (!file.location) {
                return res.error('IMAGE_UPLOAD_ERROR');
            };

            data.link = req.file.location;

            return res.success('IMAGE_UPLOAD_SUCCESS', data);
        }
        catch (err) {
            console.log("err-----", err);
            res.error("INTERNAL_SERVER_ERROR");
        }
    },
}