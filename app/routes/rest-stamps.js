var restInterfaces = require('./rest-interfaces')();
var stamps = require("../services/stamps");
var ownerships = require("../services/ownerships");
var Logger = require('../util/logger');
var stamp = require('../model/stamp');
var extend = require('node.extend');
var Authenticator = require('../util/authenticator');
var routeHelper = require('./route-helper');
var _ = require('lodash');

var RESOURCE_PATH = "/stamps";

var logger = Logger.getLogger("server");

exports.configure = function (app, basePath) {
    "use strict";
    var service = extend(true, {}, restInterfaces);

    service.purchase = (req,res) => {
        let content = req.body;
        logger.debug(content);

        if(content.pricePaid <= 0) {
            res.status(routeHelper.StatusCode.BAD_REQUEST);
            res.send("price paid must be greater than zero.");
            return;
        } else if (_.isNil(content.currencyCode)) {
            res.status(routeHelper.StatusCode.BAD_REQUEST);
            res.send('No currency code provided');
            return;
        } else if (_.isEmpty(content.stamps)) {
            res.status(routeHelper.StatusCode.BAD_REQUEST);
            res.send('No stamps defined');
            return;
        }

        ownerships.purchase(content.stamps, content.pricePaid, content.currencyCode).then(() => {
            res.status(routeHelper.StatusCode.OK);
            return res.send();
        }, function (err) {
            res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR);
        });
    };

    app.post(basePath + RESOURCE_PATH + "/purchase", Authenticator.applyAuthentication(), service.purchase );
    service.initialize(app, basePath + RESOURCE_PATH, stamps, stamp);
};
