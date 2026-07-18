const app = require('./app');
const envConfig = require('./config/env');

function startServer() {
  app.listen(envConfig.port, () => {
    console.log(`Server is running on port ${envConfig.port}`);
  });
}

startServer();
