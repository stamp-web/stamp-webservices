"use strict";

const express = require('express');
const helmet = require('helmet');
const contentSecurityPolicy = require('helmet-csp');
const compression = require('compression');
const session = require('express-session');
const serveStatic = require('serve-static');
const morgan = require('morgan');
const connectionMgr = require('../pom/connection-mysql');
const favicon = require('serve-favicon');
const nconf = require('nconf');
const http = require('http');
const https = require('https')
const domainMiddleware = require('domain-middleware');
const FileStreamRotator = require('file-stream-rotator');
const Logger = require('../util/logger');
const Level = require('../util/level');
const Authenticator = require('../util/authenticator');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');

/**
 * Redis for production level session storage
 */
const {createRedisSessionConfig} = require("./redis-client");

nconf.argv().env().file(__dirname + '/../../config/application.json');

const SERVICES_PATH = 'rest';
const BASEPATH = nconf.get('basePath') ? nconf.get('basePath') : '/stamp-webservices/';
const CERT_CONFIG = nconf.get('Certificates');

function configureLogger(aLogger, name) {
    let silenceConsole = nconf.get('silenceConsole');
    if (silenceConsole) {
        Logger.silenceConsole();
    }
    aLogger.setLevel(nconf.get(name + '_level') ? nconf.get(name + '_level') : Level.INFO);
    if (nconf.get(name + '_target') === 'file' && nconf.get(name + '_file')) {
        aLogger.setTarget(nconf.get(name + '_target'), nconf.get(name + '_file'));
    }
}

function configureLoggerRemotely(req, resp) {
    let loggerName = req.params.logger;
    let level = req.query.level;
    let log = Logger.getLogger(loggerName);
    let msg = '';
    if (level) {
        log.setLevel(level);
        msg = `Logger "${loggerName}" successful set to ${level}`;
        console.log(msg);
        resp.status(200).send(msg);
    } else {
        msg = `Logger "${loggerName}" is set to ${log.getLevel()}`;
        console.log(msg);
        resp.status(200).send(msg);
    }
}

function showLoggers(req, resp) {
    let html = "<html><body><table><tr><th>Logger name</th><th>Level</th><th>Enable Debug</th></tr>";
    _.each(Logger.loggers, function (logger, key) {
        let _logger = Logger.getLogger(key);
        html += `<tr><td>${key}</td><td>${_logger.getLevel()}</td><td><a href="logger/${key}?level=debug"><button>Set</button></a></td></tr>`;
    });
    html += '</table></body></html>';
    resp.status(200).send(html);
}
const logger = Logger.getLogger('server')
configureLogger(logger, 'logger');
configureLogger(Logger.getLogger('sql'), 'sql');

function isSecure(certProps) {
    const httpOnly = (nconf.get('httpOnly') || !certProps)
    return !httpOnly
}

function createServer() {
    let server;
    if (!isSecure(CERT_CONFIG)) {
        server = http.createServer({});
        logger.warn('WARNING: Server is created with non-TLS protocol.');
    } else {
        if (_.get(CERT_CONFIG, 'CertificateFile') && _.get(CERT_CONFIG, 'CertificateKeyFile')) {
            server = https.createServer({
                key: fs.readFileSync(CERT_CONFIG.CertificateKeyFile),
                cert: fs.readFileSync(CERT_CONFIG.CertificateFile)
            });
        } else {
            logger.error('Either CertificateKeyFile or CertificateFile was not defined');
        }
    }
    return server;
}

async function createSessionConfig() {
    const secret = nconf.get('session_secret') || 'STAMPWEB';
    console.log('Session Secret: ' + secret )
    const sessionType = nconf.get('session_type') || 'memory';
    logger.info(`Session type: ${sessionType}`);
    if (sessionType === 'redis') {
        const redisConfig = await createRedisSessionConfig(secret);
        if(redisConfig) {
            return redisConfig
        } else {
            logger.error('Redis Config or Session could not be established.  Using Memory Session.')
        }
    }

    const sessionConfig = {
        resave: false,
        name: 'stamp-webservices',
        saveUninitialized: false,
        secret: secret,
        cookie: {
            sameSite: 'strict',
            secure: true
        }
    };
    return sessionConfig;
}

const app = express();
const sessionConfig = createSessionConfig().then(config => {
    logger.debug('session config:', config);
    app.use(session(config));

});
app.use(compression());
app.use(helmet({
    crossOriginEmbedderPolicy: false
}));
app.use(contentSecurityPolicy({
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["https:", "'self'", "data:"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
        reportOnly: false,
    })
);
app.use(morgan('tiny', {
    stream: FileStreamRotator.getStream({
        date_format: 'YYYYMMDD',
        filename: __dirname + '/../../logs/access-%DATE%.log',
        frequency: 'daily',
        verbose: false
    })
}));
app.use(favicon(__dirname + '/../../www/favicon.ico'));
app.use(express.json({strict: false}));
app.use(express.urlencoded({extended: true}));
Authenticator.initialize(app);

const server = createServer();

app.use(
    domainMiddleware({
        server: server,
        killTimeout: 3000
    }));

app.get(`${BASEPATH}config/logger`, showLoggers);
app.get(`${BASEPATH}config/logger/:logger`, configureLoggerRemotely);

const aurelia_path = path.resolve(__dirname, `..${path.sep}..${path.sep}www/aurelia/`);
const www_path = path.resolve(__dirname, `..${path.sep}..${path.sep}www/`);
const vue_path = path.resolve(__dirname, `..${path.sep}..${path.sep}www/stamp-web/`);

app.get('/', (req, res) => {
    res.redirect('/stamp-web');
});

app.use('/stamp-web', serveStatic(vue_path));
app.use('/stamp-webservices', serveStatic(www_path));
app.use('/stamp-aurelia', serveStatic(aurelia_path));
app.use(serveStatic(www_path));

require('../routes/rest-preferences').configure(app, BASEPATH + SERVICES_PATH);
require('../routes/rest-countries').configure(app, BASEPATH + SERVICES_PATH);
require('../routes/rest-albums').configure(app, BASEPATH + SERVICES_PATH);
require('../routes/rest-stampCollections').configure(app, BASEPATH + SERVICES_PATH);
require('../routes/rest-catalogues').configure(app, BASEPATH + SERVICES_PATH);
require('../routes/catalogue-numbers').configure(app, BASEPATH + SERVICES_PATH);
require('../routes/rest-sellers').configure(app, BASEPATH + SERVICES_PATH);
require('../routes/rest-stamps').configure(app, BASEPATH + SERVICES_PATH);
require('../routes/reports').configure(app, BASEPATH + SERVICES_PATH);


connectionMgr.startup().then(() => {
    process.on('exit', () => {
        connectionMgr.shutdown();
    });
    process.on('uncaughtException', err => {
        console.log(err.stack); // should update to use domains/clusters
    });
    // See if the server is running as a child process and if so signal completion of startup
    if (process.send) {
        process.send('SERVER_STARTED');
    }
}, err => {
    logger.error(err);
    process.exit(1);
});

server.on('request', app);

module.exports = server;
