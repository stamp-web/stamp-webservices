var restInterfaces = require('./rest-interfaces')();
var countries = require("../services/countries");
var country = require('../model/country');
var extend = require('node.extend');

var RESOURCE_PATH = "/countries";
    
exports.configure = function (app, basePath) {
    var countriesRest = extend(true, {},  restInterfaces);
    countriesRest.initialize(app, basePath + RESOURCE_PATH, countries, country);
}