import Logger from '../util/logger.js';
import nconf from 'nconf';

nconf.argv().env();

let port = nconf.get("port");
if (!port) {
    port = 9001;
} else {
    port = +port;
}

const logger = Logger.getLogger("server");
const serverModule = await import('./server-app.js');
const server = serverModule.default;
server.listen(port);
logger.info("Server listening on port " + port + ", process=" + process.pid);

