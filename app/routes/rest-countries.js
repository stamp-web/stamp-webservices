var restInterfaces = require('./rest-interfaces')();
var entityManaged = require('./rest-entitymanaged');
var countries = require("../services/countries");
var country = require('../model/country');
var extend = require('node.extend');
var Authenticator = require('../util/authenticator');
var routeHelper = require('./route-helper');

var RESOURCE_PATH = "/countries";

exports.configure = function (app, basePath) {
    "use strict";

    var countriesRest = extend(true, {}, new entityManaged(countries), restInterfaces);

    app.get(basePath + RESOURCE_PATH + "/!countStamps", Authenticator.applyAuthentication(), countriesRest.countStamps);
    countriesRest.initialize(app, basePath + RESOURCE_PATH, countries, country);
};