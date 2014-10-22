var restInterfaces = require('./rest-interfaces')();
var stamps = require("../services/stamps");
var stamp = require('../model/stamp');
var extend = require('node.extend');

var RESOURCE_PATH = "/stamps";

exports.configure = function (app, basePath) {
    "use strict";
    var stampsRest = extend(true, {}, restInterfaces);
    stampsRest.initialize(app, basePath + RESOURCE_PATH, stamps, stamp);
};
