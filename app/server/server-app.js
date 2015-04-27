"use strict";

var express = require("express");
var connectionMgr = require('../pom/connection-mysql');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var nconf = require('nconf');
var http = require('http');
var connect = require('connect');
var domainMiddleware = require('domain-middleware');
var Logger = require('../util/logger');
var Level = require('../util/level');
var Authenticator = require('../util/authenticator');
var _ = require('../../lib/underscore/underscore');
var path = require('path');

nconf.argv().env();

var SERVICES_PATH = "rest";
var BASEPATH = "/stamp-webservices/";
if (nconf.get("basePath")) {
    BASEPATH = nconf.get("basePath");
}

function configureLogger(aLogger, name) {
    aLogger.setLevel(nconf.get(name + "_level") ? nconf.get(name + "_level") : Level.INFO);
    if (nconf.get(name + "_target") === "file" && nconf.get(name + "_file")) {
        logger.setTarget(nconf.get(name + "_target"), nconf.get(name + "_file"));
    }
}

function configureLoggerRemotely(req, resp) {
    var loggerName = req.params.logger;
    var level = req.query.level;
    var log = Logger.getLogger(loggerName);
    var msg = "";
    if (level) {
        log.setLevel(level);
        msg = "Logger \"" + loggerName + "\" successful set to " + level;
        console.log(msg);
        resp.status(200).send(msg);
    } else {
        msg = "Logger \"" + loggerName + "\" is set to " + log.getLevel();
        console.log(msg);
        resp.status(200).send(msg);
    }
}

function showLoggers(req,resp) {
    var html = "<html><body><table><tr><th>Logger name</th><th>Level</th><th>Enable Debug</th></tr>";
    _.each(Logger.loggers, function(logger,key) {
        var _logger = Logger.getLogger(key);
        html += "<tr><td>" + key + "</td><td>" + _logger.getLevel() + "</td><td><a href=\"logger/" + key + "?level=debug\"><button>Set</button></a></td></tr>";
    });
    html += "</table></body></html>";
    resp.status(200).send(html);
}

var server = http.createServer();
var app = express();

app.use(favicon(__dirname + '/../../public/favicon.ico'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

Authenticator.initialize(app);

app.use(
    domainMiddleware({
        server: server,
        killTimeout: 3000
    }));

app.get(BASEPATH + "config/logger", showLoggers);
app.get(BASEPATH + "config/logger/:logger", configureLoggerRemotely);

var material_path = path.resolve(__dirname, '..' + path.sep + '..' + path.sep + 'www/material/');
var aurelia_path = path.resolve(__dirname, '..' + path.sep + '..' + path.sep + 'www/aurelia/');
var www_path = path.resolve(__dirname, '..' + path.sep + '..' + path.sep + 'www/');
app.get('/stamp-web/*', function (req, res) {
    res.sendfile(www_path + path.sep + req.params['0']);
});

app.get('/stamp-material/*', function (req, res) {
    res.sendfile(material_path + path.sep + req.params['0']);
});

app.get('/stamp-aurelia/*', function (req, res) {
    res.sendfile(aurelia_path + path.sep + req.params['0']);
});

require("../routes/rest-preferences").configure(app, BASEPATH + SERVICES_PATH);
require("../routes/rest-countries").configure(app, BASEPATH + SERVICES_PATH);
require("../routes/rest-albums").configure(app, BASEPATH + SERVICES_PATH);
require("../routes/rest-stampCollections").configure(app, BASEPATH + SERVICES_PATH);
require("../routes/rest-catalogues").configure(app, BASEPATH + SERVICES_PATH);
require("../routes/catalogue-numbers").configure(app, BASEPATH + SERVICES_PATH);
require("../routes/rest-sellers").configure(app, BASEPATH + SERVICES_PATH);
require("../routes/rest-stamps").configure(app, BASEPATH + SERVICES_PATH);
require("../routes/reports").configure(app, BASEPATH + SERVICES_PATH);


var logger = Logger.getLogger("server");
var sqlTrace = Logger.getLogger("sql");

configureLogger(logger, "logger");
configureLogger(sqlTrace, "sql");

connectionMgr.startup().then(function () {
    process.on('exit', function () {
        connectionMgr.shutdown();
    });
    process.on('uncaughtException', function(err) {
        console.log(err.stack); // should update to use domains/clusters
    });
    // See if the server is running as a child process and if so signal completion of startup
    if (process.send) {
        process.send("SERVER_STARTED");
    }
}, function (err) {
    logger.error(err);
    process.exit(1);
});

server.on('request', app);

module.exports = server;


