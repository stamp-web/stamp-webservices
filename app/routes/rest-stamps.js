import restInterfaces from './rest-interfaces.js';
import stamps from "../services/stamps.js";
import ownerships from "../services/ownerships.js";
import Logger from '../util/logger.js';
import stamp from '../model/stamp.js';
import extend from 'node.extend';
import Authenticator from '../util/authenticator.js';
import routeHelper from './route-helper.js';
import _ from 'lodash';

const RESOURCE_PATH = "/stamps";

const logger = Logger.getLogger("server");

export const configure = (app, basePath) => {
    const service = extend(true, {}, new restInterfaces());

    service.purchase = (req, res) => {
        const content = req.body;
        logger.debug(content);

        if (content.pricePaid <= 0) {
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

    app.post(`${basePath}${RESOURCE_PATH}/purchase`, Authenticator.applyAuthentication(), service.purchase);
    service.initialize(app, `${basePath}${RESOURCE_PATH}`, stamps, stamp);
};