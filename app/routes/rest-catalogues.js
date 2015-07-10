var restInterfaces = require('./rest-interfaces')();
var entityManaged = require('./rest-entitymanaged');
var catalogues = require("../services/catalogues");
var catalogue = require('../model/catalogue');
var Authenticator = require('../util/authenticator');
var extend = require('node.extend');

var RESOURCE_PATH = "/catalogues";

exports.configure = function (app, basePath) {
    "use strict";
    var service = extend(true, {}, new entityManaged(catalogues), restInterfaces);
    app.get(basePath + RESOURCE_PATH + "/!countStamps", Authenticator.applyAuthentication(), service.countStamps);
    service.initialize(app, basePath + RESOURCE_PATH, catalogues, catalogue);
};
