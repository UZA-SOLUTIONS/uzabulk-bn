require('./utils/globals');
const logger = require('./config/logger');
const { connectDatabase } = require('./config/db');

const NODE_MAJOR_VERSION = Number(process.versions.node.split('.')[0]);
const MIN_SUPPORTED_NODE_MAJOR = 18;
const MAX_SUPPORTED_NODE_MAJOR = 25;

if (
  Number.isNaN(NODE_MAJOR_VERSION)
  || NODE_MAJOR_VERSION < MIN_SUPPORTED_NODE_MAJOR
  || NODE_MAJOR_VERSION > MAX_SUPPORTED_NODE_MAJOR
) {
  logger.error(
    { apiModule: 'server', apiHandler: 'server.js' },
    `Unsupported Node.js version ${process.version}. Use Node ${MIN_SUPPORTED_NODE_MAJOR}-${MAX_SUPPORTED_NODE_MAJOR} (see .nvmrc).`
  );
  process.exit(1);
}

const app = require('./app');

let server;

const startServer = async () => {
  try {
    await connectDatabase();
  } catch (error) {
    logger.error(
      { apiModule: 'server', apiHandler: 'server.js' },
      `Cannot start API without MongoDB: ${error.message}`
    );
    console.error('Cannot start API without MongoDB. Check MONGO_URI in .env and network access.');
    process.exit(1);
  }

  server = app.listen(env.PORT, () => {
    logger.info({ apiModule: "server", apiHandler: "server.js" }, `Listening to port ${env.PORT}`);
    try {
      const { startOAuthRefreshJob } = require("./jobs/oauthRefreshJob");
      startOAuthRefreshJob();
    } catch (oauthJobErr) {
      logger.warn(
        { apiModule: "server", apiHandler: "server.js" },
        `1688 OAuth refresh job not started: ${oauthJobErr.message}`
      );
    }
    try {
      const { startSupplierVerificationJob } = require("./jobs/supplierVerificationJob");
      startSupplierVerificationJob();
    } catch (jobErr) {
      logger.warn(
        { apiModule: "server", apiHandler: "server.js" },
        `Supplier verification job not started: ${jobErr.message}`
      );
    }
    try {
      const { startLogisticsPollingJob } = require("./jobs/logisticsPollingJob");
      startLogisticsPollingJob();
    } catch (jobErr) {
      logger.warn(
        { apiModule: "server", apiHandler: "server.js" },
        `1688 logistics job not started: ${jobErr.message}`
      );
    }
    try {
      const { startCatalogSyncJob } = require("./jobs/catalogSyncJob");
      startCatalogSyncJob();
    } catch (jobErr) {
      logger.warn(
        { apiModule: "server", apiHandler: "server.js" },
        `1688 catalog sync job not started: ${jobErr.message}`
      );
    }
    try {
      const { startEsProductSyncJob } = require("./jobs/esProductSyncJob");
      startEsProductSyncJob();
    } catch (jobErr) {
      logger.warn(
        { apiModule: "server", apiHandler: "server.js" },
        `ES product sync job not started: ${jobErr.message}`
      );
    }
  });
};

startServer();

const unexpectedErrorHandler = (error) => {
  logger.error({ apiModule: "server", apiHandler: "server.js" }, error);
};
process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info({ apiModule: "server", apiHandler: "server.js" }, 'SIGTERM received');
  if (server) {
    server.close();
  }
});
