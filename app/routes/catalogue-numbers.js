var restInterfaces = require('./rest-interfaces')();
var catalogueNumbers = require("../services/catalogue-numbers");
var catalogueNumber = require('../model/catalogue-number');
var stamp = require('../model/stamp');
var extend = require('node.extend');
var Authenticator = require('../util/authenticator');
var routeHelper = require('./route-helper');

var RESOURCE_PATH = "/catalogueNumbers";

exports.configure = function (app, basePath) {
    "use strict";
    var service = extend(true, {}, restInterfaces);

    service.makeActive = function(req,res) {
        catalogueNumbers.makeActive(req.params.id).then(function (row) {
            if (row !== null) {
                var data = stamp.externalize(row);
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.OK);
                return res.json(data);
            } else {
                res.status(routeHelper.StatusCode.NOT_FOUND).end();
            }
        }, function (err) {
            res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR);
        });
    };

    app.post(basePath + RESOURCE_PATH + "/:id/makeActive", Authenticator.applyAuthentication(), service.makeActive );
    service.initialize(app, basePath + RESOURCE_PATH, catalogueNumbers, catalogueNumber);


};
