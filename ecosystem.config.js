module.exports = {
    apps: [
        {
            name: "uza-customer-api",
            script: "./server.js",
            watch: false,
            env_staging: {
                "PORT": process.env.PORT || 1302,
                "NODE_ENV": "development"
            },
            env_production: {
                "PORT": process.env.PORT || 3089,
                "NODE_ENV": "production",
            }
        }
    ]
}