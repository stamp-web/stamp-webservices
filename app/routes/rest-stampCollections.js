const stampCollections = require("../services/stamp-collections");
const entityManaged = require('./rest-entitymanaged');
const stampCollection = require('../model/stamp-collection');
const restInterfaces = require('./rest-interfaces')();
const Authenticator = require('../util/authenticator');
const extend = require('node.extend');

const RESOURCE_PATH = "/stampCollections";

exports.configure = (app, basePath) => {

    const scRest = extend(true, {}, new entityManaged(stampCollections), restInterfaces);
    app.get(basePath + RESOURCE_PATH + "/\\!countStamps", Authenticator.applyAuthentication(), scRest.countStamps);
    scRest.initialize(app, basePath + RESOURCE_PATH, stampCollections, stampCollection);
};