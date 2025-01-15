const restInterfaces = require('./rest-interfaces')();
const stamps = require("../services/stamps");
const ownerships = require("../services/ownerships");
const Logger = require('../util/logger');
const stamp = require('../model/stamp');
const extend = require('node.extend');
const Authenticator = require('../util/authenticator');
const routeHelper = require('./route-helper');
const _ = require('lodash');

const RESOURCE_PATH = "/stamps";

const logger = Logger.getLogger("server");

exports.configure = (app, basePath) => {
    const service = extend(true, {}, restInterfaces);

    service.purchase = (req,res) => {
        const content = req.body;
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
        }, () => {
            res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR);
        });
    };

    app.post(`${basePath}${RESOURCE_PATH}/purchase`, Authenticator.applyAuthentication(), service.purchase );
    service.initialize(app, `${basePath}${RESOURCE_PATH}`, stamps, stamp);
};
