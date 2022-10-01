var restInterfaces = require('./rest-interfaces')();
var entityManaged = require('./rest-entitymanaged');
var albums = require("../services/albums");
var album = require('../model/album');
var extend = require('node.extend');
var Logger = require('../util/logger');
var Authenticator = require('../util/authenticator');
var routeHelper = require('./route-helper');

var logger = Logger.getLogger("server");

var RESOURCE_PATH = "/albums";

exports.configure = function (app, basePath) {
    "use strict";
    var service = extend(true, {}, new entityManaged(albums), restInterfaces);

    service.moveTo = function(req, res) {
        var scId = req.params.scId;
        var params = {
            stampCollectionRef: scId
        };
        albums.update(params, req.params.id).then(function(obj) {
            res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
            res.status(routeHelper.StatusCode.OK);
            var data = album.externalize(obj);
            return res.json(data);
        }, function (err) {
            logger.error(err);
            routeHelper.setErrorStatus(res, err);
        });

    };
    app.post(basePath + RESOURCE_PATH + "/:id/moveTo/:scId", Authenticator.applyAuthentication(), service.moveTo );
    app.get(basePath + RESOURCE_PATH + "/!countStamps", Authenticator.applyAuthentication(), service.countStamps);
    service.initialize(app, basePath + RESOURCE_PATH, albums, album);
};
