var restInterfaces = require('./rest-interfaces');
var preferences = require("../services/preferences");
var preference = require('../model/preference');

var RESOURCE_PATH = "/preferences";

function _list(req, res) {
    restInterfaces.find(req, res, preferences, preference);
};

function _findById(req, res) {
    restInterfaces.findById(req, res, preferences, preference);
}

function _delete(req, res) {
    restInterfaces.remove(req, res, preferences);
}

exports.configure = function (app, basePath) {
    app.get(basePath + RESOURCE_PATH, _list);
    app.get(basePath + RESOURCE_PATH + '/:id', _findById);
    app.delete(basePath + RESOURCE_PATH + '/:id', _delete);
}