var restInterfaces = require('./rest-interfaces');
var countries = require("../services/countries");
var country = require('../model/country');

var RESOURCE_PATH = "/countries";

function list(req, res) {
    restInterfaces.find(req, res, countries, country);
};

function create(req, res) {
    restInterfaces.create(req, res, countries, country);  
};

function update(req, res) {
    restInterfaces.update(req, res, countries, country);  
};

function _findById(req, res) {
    restInterfaces.findById(req, res, countries, country);   
}

function _delete(req, res) {
    restInterfaces.remove(req, res, countries);
}


exports.configure = function (app, basePath) {
    app.get(basePath + RESOURCE_PATH, list);
    app.post(basePath + RESOURCE_PATH, create);
    app.put(basePath + RESOURCE_PATH + "/:id", update);
    app.get(basePath + RESOURCE_PATH + "/:id", _findById);
    app.delete(basePath + RESOURCE_PATH + '/:id', _delete);
}