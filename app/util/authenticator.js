const passport = require('passport');
const BasicStrategy = require('passport-http').BasicStrategy;
const nconf = require('nconf');
const _ = require('lodash');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const Logger = require('./logger');
const Level = require('./level');

nconf.argv().env().file(__dirname + '/../../config/application.json');

const logger = Logger.getLogger('user-auth');

let UserCache;
const authType = nconf.get("authentication");
logger.debug("Authentication Type specified: " + authType);

function Authenticator() {}

const BasicValidation = {};

BasicValidation.validator = function(username, password, done) {
    const user = _.find(BasicValidation.getUserCache(), {username: username});
    if(logger.isEnabled(Level.DEBUG)) {
        logger.debug(`For username '${username}' found user : '${user}'`);
    }

    if (!username || !user || username !== user.username) {
        return done(null, false);
    }
    if (!password || !user || password !== user.password) {
        return done(null, false);
    }
    return done(null, user);
};

BasicValidation.getUserCache = function( ) {
    if( !UserCache ) {
        let file = nconf.get("password_file");
        if( !file ) {
            file = '../../config/users.json';
        }
        UserCache = require(file);
    }
    return UserCache;
}

BasicValidation.serializeUser = function(user,done) {
    done(null, user.id);
};

BasicValidation.deserializeUser = function(id,done) {
    done(null,_.find(BasicValidation.getUserCache(), {id: id}));
};

Authenticator.initialize = function(app) {
    const result  = {configured: false, authType: authType};
    if( authType !== null && authType !== 'none') {
        const sessionSecret = nconf.get("authentication-session-secret");
        if (!sessionSecret) {
            throw new Error('Session secret must be configured via "authentication-session-secret" in config');
        }
        app.use(cookieParser());
        app.use(session({
            name: 'stamp-webservices',
            secret: sessionSecret,
            resave: false,
            saveUninitialized: true,
            cookie: {
                maxAge: 3600000 // one hour
            }
        }));
        app.use(passport.initialize());
        app.use(passport.session());

        switch(authType) {
            case 'basic':
                try {
                    passport.serializeUser(BasicValidation.serializeUser);
                    passport.deserializeUser(BasicValidation.deserializeUser);
                    passport.use(new BasicStrategy({}, BasicValidation.validator));
                    logger.info('Basic authentication strategy configured successfully');
                } catch (err) {
                    logger.error(`Failed to configure basic authentication: ${err.message}`);
                    throw err;
                }
                break;
            default:
                logger.warn(`Unknown authentication type: ${authType}`);
                break;
        }
        result.configured = true;
    }

    return result;
};

Authenticator.applyAuthentication = function() {
    if( authType !== null ) {
        switch(authType) {
            case 'basic':
                return passport.authenticate('basic', { session: true });
            default:
                logger.warn(`Unknown authentication type in applyAuthentication: ${authType}`);
                break;
        }
    }
    return function(req,res,next) { next(); };
};

module.exports = Authenticator;