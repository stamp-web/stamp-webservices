import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import serveStatic from 'serve-static';
import morgan from 'morgan';
import connectionMgr from '../pom/connection-mysql.js';
import favicon from 'serve-favicon';
import nconf from 'nconf';
import http from 'http';
import https from 'https';
import domainMiddleware from 'domain-middleware';
import FileStreamRotator from 'file-stream-rotator';
import Logger from '../util/logger.js';
import Level from '../util/level.js';
import Authenticator from '../util/authenticator.js';
import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRedisSessionConfig } from './redis-client.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import CommonJS modules that don't support ES6 properly
const contentSecurityPolicy = require('helmet-csp');

nconf.argv().env().file(path.join(__dirname, '/../../config/application.json'));

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
    logger.info('Session Secret: ' + secret )
    const sessionType = nconf.get('session_type') || 'memory';
    logger.info(`Session type: ${sessionType}`);
    if (sessionType === 'redis') {
        const redisConfig = await createRedisSessionConfig(secret);
        if (redisConfig) {
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
const sessionConfig = await createSessionConfig();
logger.debug('session config:', sessionConfig);
app.use(session(sessionConfig));
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
}));
app.use(morgan('tiny', {
    stream: FileStreamRotator.getStream({
        date_format: 'YYYYMMDD',
        filename: path.join(__dirname, '/../../logs/access-%DATE%.log'),
        frequency: 'daily',
        verbose: false
    })
}));
app.use(favicon(path.join(__dirname, '/../../www/favicon.ico')));
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

const AURELIA_PATH = path.resolve(__dirname, `..${path.sep}..${path.sep}www/aurelia/`);
const WWW_PATH = path.resolve(__dirname, `..${path.sep}..${path.sep}www/`);
const VUEJS_PATH = path.resolve(__dirname, `..${path.sep}..${path.sep}www/stamp-web/`);

app.use('/stamp-web', serveStatic(VUEJS_PATH));
app.use('/stamp-webservices', serveStatic(WWW_PATH));
app.use('/stamp-aurelia', serveStatic(AURELIA_PATH));

app.get('/', (req, res) => {
    res.redirect('/stampweb/index.html');
});

app.use(serveStatic(WWW_PATH));

const restPreferences = await import('../routes/rest-preferences.js');
const restCountries = await import('../routes/rest-countries.js');
const restAlbums = await import('../routes/rest-albums.js');
const restStampCollections = await import('../routes/rest-stampCollections.js');
const restCatalogues = await import('../routes/rest-catalogues.js');
const catalogueNumbers = await import('../routes/catalogue-numbers.js');
const restSellers = await import('../routes/rest-sellers.js');
const restStamps = await import('../routes/rest-stamps.js');
const reports = await import('../routes/reports.js');

restPreferences.configure(app, BASEPATH + SERVICES_PATH);
restCountries.configure(app, BASEPATH + SERVICES_PATH);
restAlbums.configure(app, BASEPATH + SERVICES_PATH);
restStampCollections.configure(app, BASEPATH + SERVICES_PATH);
restCatalogues.configure(app, BASEPATH + SERVICES_PATH);
catalogueNumbers.configure(app, BASEPATH + SERVICES_PATH);
restSellers.configure(app, BASEPATH + SERVICES_PATH);
restStamps.configure(app, BASEPATH + SERVICES_PATH);
reports.configure(app, BASEPATH + SERVICES_PATH);

connectionMgr.startup().then(() => {
    process.on('exit', () => {
        connectionMgr.shutdown();
    });
    process.on('uncaughtException', err => {
        console.log(err.stack); // should update to use domains/clusters
    });
    if (process.send) {
        process.send('SERVER_STARTED');
    }
}, err => {
    logger.error(err);
    process.exit(1);
});

server.on('request', app);

export default server;