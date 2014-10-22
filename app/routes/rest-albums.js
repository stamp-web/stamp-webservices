var restInterfaces = require('./rest-interfaces')();
var albums = require("../services/albums");
var album = require('../model/album');
var extend = require('node.extend');

var RESOURCE_PATH = "/albums";

exports.configure = function (app, basePath) {
    "use strict";
    var albumsRest = extend(true, {}, restInterfaces);
    albumsRest.initialize(app, basePath + RESOURCE_PATH, albums, album);
};
