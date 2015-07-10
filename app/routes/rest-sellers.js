var restInterfaces = require('./rest-interfaces')();
var entityManaged = require('./rest-entitymanaged');
var Authenticator = require('../util/authenticator');
var sellers = require("../services/sellers");
var seller = require('../model/seller');
var extend = require('node.extend');

var RESOURCE_PATH = "/sellers";

exports.configure = function (app, basePath) {
    "use strict";
    var sellersRest = extend(true, {}, new entityManaged(sellers),  restInterfaces);
    app.get(basePath + RESOURCE_PATH + "/!countStamps", Authenticator.applyAuthentication(), sellersRest.countStamps);
    sellersRest.initialize(app, basePath + RESOURCE_PATH, sellers, seller);
};
