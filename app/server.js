var express = require("express");
var connectionMgr = require('./pom/connection-mysql');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var nconf = require('nconf');
var logger = require('./util/logger');

var SERVICES_PATH = "/rest";
nconf.argv().env();

var app = express();

app.use(favicon(__dirname + '/../public/favicon.ico'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

require("./routes/rest-preferences").configure(app, SERVICES_PATH);
require("./routes/rest-countries").configure(app, SERVICES_PATH);
require("./routes/rest-albums").configure(app, SERVICES_PATH);
require("./routes/rest-stampCollections").configure(app, SERVICES_PATH);

var port = nconf.get("port");
if (!port) {
    port = 9001;
} else {
    port = +port;
}

logger.log(logger.INFO, "HTTPServer listening on port " + port);
if (nconf.get("logger_target") === "file" && nconf.get("logger_file")) {
    logger.setTarget(nconf.get("logger_target"), nconf.get("logger_file"));   
}
app.listen(port);
connectionMgr.startup();

process.on('exit', function () {
    connectionMgr.shutdown();
});

// See if the server is running as a child process and if so signal completion of startup
if (process.send) {
    process.send("SERVER_STARTED");
}
