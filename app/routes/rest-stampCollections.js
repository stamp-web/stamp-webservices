var restInterfaces = require('./rest-interfaces');
var stampCollections = require("../services/stamp-collections");
var stampCollection = require('../model/stamp-collection');

var RESOURCE_PATH = "/stampCollections";

function list(req, res) {
    restInterfaces.find(req, res, stampCollections, stampCollection);
};

function create(req, res) {
    restInterfaces.create(req, res, stampCollections, stampCollection);  
};

function update(req, res) {
    restInterfaces.update(req, res, stampCollections, stampCollection);  
};

function findById(req, res) {
    restInterfaces.findById(req, res, stampCollections, stampCollection);   
}

function remove(req, res) {
    restInterfaces.remove(req, res, stampCollections);
}


exports.configure = function (app, basePath) {
    app.get(basePath + RESOURCE_PATH, list);
    app.post(basePath + RESOURCE_PATH, create);
    app.put(basePath + RESOURCE_PATH + "/:id", update);
    app.get(basePath + RESOURCE_PATH + "/:id", findById);
    app.delete(basePath + RESOURCE_PATH + '/:id', remove);
}