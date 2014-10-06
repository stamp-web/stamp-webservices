var restInterfaces = require('./rest-interfaces');
var albums = require("../services/albums");
var album = require('../model/album');

var RESOURCE_PATH = "/albums";

function list(req, res) {
    restInterfaces.find(req, res, albums, album);
};

function create(req, res) {
    restInterfaces.create(req, res, albums, album);  
};

function update(req, res) {
    restInterfaces.update(req, res, albums, album);  
};

function findById(req, res) {
    restInterfaces.findById(req, res, albums, album);   
}

function remove(req, res) {
    restInterfaces.remove(req, res, albums);
}


exports.configure = function (app, basePath) {
    app.get(basePath + RESOURCE_PATH, list);
    app.post(basePath + RESOURCE_PATH, create);
    app.put(basePath + RESOURCE_PATH + "/:id", update);
    app.get(basePath + RESOURCE_PATH + "/:id", findById);
    app.delete(basePath + RESOURCE_PATH + '/:id', remove);
}