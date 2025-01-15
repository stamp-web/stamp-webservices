const restInterfaces = require('./rest-interfaces')();
const entityManaged = require('./rest-entitymanaged');
const catalogues = require("../services/catalogues");
const catalogue = require('../model/catalogue');
const Authenticator = require('../util/authenticator');
const extend = require('node.extend');

const RESOURCE_PATH = "/catalogues";

exports.configure = (app, basePath) => {
    const service = extend(true, {}, new entityManaged(catalogues), restInterfaces);
    app.get(basePath + RESOURCE_PATH + "/\\!countStamps", Authenticator.applyAuthentication(), service.countStamps);
    service.initialize(app, basePath + RESOURCE_PATH, catalogues, catalogue);
};
