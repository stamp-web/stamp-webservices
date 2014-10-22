var stampCollections = require("../services/stamp-collections");
var stampCollection = require('../model/stamp-collection');

var restInterfaces = require('./rest-interfaces')();
var extend = require('node.extend');

var RESOURCE_PATH = "/stampCollections";

exports.configure = function (app, basePath) {
    "use strict";
    var scRest = extend(true, {}, restInterfaces);
    scRest.initialize(app, basePath + RESOURCE_PATH, stampCollections, stampCollection);
};