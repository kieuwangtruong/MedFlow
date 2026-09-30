const app = require('./app');
const envConfig = require('./config/env');

const HOST = '0.0.0.0';

function startServer() {
  app.listen(envConfig.port, HOST, () => {
    console.log(`Server is running on http://${HOST}:${envConfig.port}`);
  });
}

startServer();
