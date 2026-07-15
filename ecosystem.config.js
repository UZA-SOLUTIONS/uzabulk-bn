module.exports = {
    apps: [
        {
            name: "uza-customer-api",
            script: "./server.js",
            watch: false,
            max_memory_restart: "500M",
            kill_timeout: 5000,
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
