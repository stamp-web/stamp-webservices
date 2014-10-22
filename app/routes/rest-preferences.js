var preferences = require("../services/preferences");
var preference = require('../model/preference');
var restInterfaces = require('./rest-interfaces')();
var extend = require('node.extend');

var RESOURCE_PATH = "/preferences";

exports.configure = function (app, basePath) {
    "use strict";
    var prefsRest = extend(true, {}, restInterfaces);
    prefsRest.initialize(app, basePath + RESOURCE_PATH, preferences, preference);
};