const restInterfaces = require('./rest-interfaces')();
const entityManaged = require('./rest-entitymanaged');
const Authenticator = require('../util/authenticator');
const sellers = require("../services/sellers");
const seller = require('../model/seller');
const extend = require('node.extend');

const RESOURCE_PATH = "/sellers";

exports.configure = (app, basePath) => {
    const sellersRest = extend(true, {}, new entityManaged(sellers), restInterfaces);
    app.get(basePath + RESOURCE_PATH + "/\\!countStamps", Authenticator.applyAuthentication(), sellersRest.countStamps);
    sellersRest.initialize(app, basePath + RESOURCE_PATH, sellers, seller);
};
