var stampCollections = require("../services/stamp-collections");
var entityManaged = require('./rest-entitymanaged');
var stampCollection = require('../model/stamp-collection');
var restInterfaces = require('./rest-interfaces')();
var Authenticator = require('../util/authenticator');
var extend = require('node.extend');

var RESOURCE_PATH = "/stampCollections";

exports.configure = function (app, basePath) {
    "use strict";
    var scRest = extend(true, {},  new entityManaged(stampCollections), restInterfaces);
    app.get(basePath + RESOURCE_PATH + "/!countStamps", Authenticator.applyAuthentication(), scRest.countStamps);
    scRest.initialize(app, basePath + RESOURCE_PATH, stampCollections, stampCollection);
};