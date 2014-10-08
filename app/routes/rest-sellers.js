var restInterfaces = require('./rest-interfaces')();
var sellers = require("../services/sellers");
var seller = require('../model/seller');
var extend = require('node.extend');

var RESOURCE_PATH = "/sellers";

exports.configure = function (app, basePath) {
    var sellersRest = extend(true, {}, restInterfaces);
    sellersRest.initialize(app, basePath + RESOURCE_PATH, sellers, seller);
}
