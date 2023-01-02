"use strict";
var Logger = require('../util/logger');

var nconf = require('nconf');
nconf.argv().env();

var port = nconf.get("port");
if (!port) {
    port = 9001;
} else {
    port = +port;
}

var logger = Logger.getLogger("server");
var server = require('./server-app');
server.listen(port);
logger.info("Server listening on port " + port + ", process=" + process.pid);

