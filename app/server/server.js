const Logger = require('../util/logger');

const nconf = require('nconf');
nconf.argv().env();

let port = nconf.get("port");
if (!port) {
    port = 9001;
} else {
    port = +port;
}

const logger = Logger.getLogger("server");
const server = require('./server-app');
server.listen(port);
logger.info("Server listening on port " + port + ", process=" + process.pid);

