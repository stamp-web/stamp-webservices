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

function create(req, res) {
    restInterfaces.create(req, res, preferences, preference);
};

function update(req, res) {
    restInterfaces.update(req, res, preferences, preference);
};

function remove(req, res) {
    restInterfaces.remove(req, res, preferences);
}

exports.configure = function (app, basePath) {
    app.get(basePath + RESOURCE_PATH, _list);
    app.get(basePath + RESOURCE_PATH + '/:id', _findById);
    app.post(basePath + RESOURCE_PATH, create);
    app.put(basePath + RESOURCE_PATH + "/:id", update);
    app.delete(basePath + RESOURCE_PATH + '/:id', remove);
}