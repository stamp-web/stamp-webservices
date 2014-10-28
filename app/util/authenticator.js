var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;
var nconf = require('nconf');
var _ = require('../../lib/underscore/underscore');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var Logger = require('./logger');
var Level = require('./level');

nconf.argv().env().file(__dirname + '/../../config/application.json');

var logger = Logger.getLogger('user-auth');

var UserCache;
var authType = nconf.get("authentication");
logger.debug("Authentication Type specified: " + authType);

function Authenticator() {}

var BasicValidation = {}

BasicValidation.validator = function(username, password, done) {
    "use strict";
    var user = _.findWhere(BasicValidation.getUserCache(), {username: username});
    if(logger.isEnabled(Level.DEBUG)) {
        logger.debug("For username \'" + username + " found user : " + user);
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
    "use strict";
    if( !UserCache ) {
        var file = nconf.get("password_file")
        if( !file ) {
            file = '../../config/users.json';
        }
        UserCache = require(file);
    }
    return UserCache;
}

BasicValidation.serializeUser = function(user,done) {
    "use strict";
    done(null, user.id);
};

BasicValidation.deserializeUser = function(id,done) {
    "use strict";
    done(null,_.findWhere(BasicValidation.getUserCache(), {id: id}));
};

Authenticator.initialize = function(app) {
    "use strict";
    if( authType !== null && authType !== 'none') {
        app.use(cookieParser());
        app.use(session({
            name: 'stamp-webservices',
            secret: 'e523f4f181cf6beb7c3dbdb2182acb1f',
            resave: false,
            saveUninitialized: true,
            cookie: {
                maxAge: 36000 // one hour
            }
        }));
        app.use(passport.initialize());
        app.use(passport.session());

        switch(authType) {
            case 'basic':
                passport.serializeUser(BasicValidation.serializeUser);
                passport.deserializeUser(BasicValidation.deserializeUser);
                passport.use(new BasicStrategy({}, BasicValidation.validator));
                break;
        }

    }
};

Authenticator.applyAuthentication = function() {
    "use strict";
    if( authType !== null ) {
        switch(authType) {
            case 'basic':
                return passport.authenticate('basic', { session: true });
        }
    }
    return function(req,res,next) { next(); };
};

module.exports = Authenticator;