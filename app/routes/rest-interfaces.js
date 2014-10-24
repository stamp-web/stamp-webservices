var _ = require('../../lib/underscore/underscore');
var odata = require('../util/odata-parser');
var Logger = require('../util/logger');
var routeHelper = require('./route-helper');

var logger = Logger.getLogger("server");
var initialized = false;

function restInterfaces() {
    "use strict";

    var collection;
    var field;

    return {
        initialize: function (app, basePath, col, f) {

            collection = col;
            field = f;

            app.get(basePath, this.find);
            app.post(basePath, this.create);
            app.put(basePath + "/:id", this.update);
            app.get(basePath + "/!count", this.count);
            app.get(basePath + "/:id", this.findById);
            app.delete(basePath + '/:id', this.remove);
            logger.log(Logger.DEBUG, "   Registering services at " + basePath);
        },
        findById: function (req, res) {
            var that = this;
            var id = routeHelper.findIdFromPath(req.url);
            collection.findById(id).then(function (row) {
                if (row !== null) {
                    var data = field.externalize(row);
                    res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                    res.status(routeHelper.StatusCode.OK);
                    res.send(JSON.stringify(data));
                } else {
                    res.status(routeHelper.StatusCode.NOT_FOUND).end();
                }
            }, function (err) {
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR);
            });
        },
        update: function (req, res) {
            var that = this;
            var id = routeHelper.findIdFromPath(req.url);
            collection.update(req.body, id).then(function (obj) {
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.OK);
                var data = field.externalize(obj);
                res.send(JSON.stringify(data));
            }, function (err) {
                logger.log(Logger.ERROR, err);
                routeHelper.setErrorStatus(res, err);
            });
        },
        create: function (req, res) {
            var that = this;
            collection.create(req.body).then(function (obj) {
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.CREATED);
                var data = field.externalize(obj);
                res.send(JSON.stringify(data));
            }, function (err) {
                logger.log(Logger.ERROR, err);
                routeHelper.setErrorStatus(res, err);
            });
    
        },
        count: function (req, res) {
            var filter = (req.query && req.query.$filter) ? odata.toPredicates(req.query.$filter) : null;
            var that = this;
            collection.count(filter).then(function (result) {
                res.format({
                    'text/plain': function () {
                        res.send('' + result);
                    },
                    'application/json': function () {
                        res.json({ count: result });
                    }
                });
            }, function (err) {
                logger.log(Logger.DEBUG, err);
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR).end();
            });
        },
        find: function (req, res) {
            var filter = (req.query && req.query.$filter) ? odata.toPredicates(req.query.$filter) : null;
            var limit = req.query.$top;
            var offset = req.query.$skip;
            var orderby = req.query.$orderby;
            var that = this;
            collection.find(filter, limit, offset, orderby).then(function (data) {
                var result = {
                    total: data.total
                };
                result[collection.collectionName] = [];
                _.each(data.rows, function (row) {
                    result[collection.collectionName].push(field.externalize(row));
                });
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.OK);
                res.json(result);
            }, function (err) {
                logger.log(Logger.ERROR, err);
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR).end();
            });
        },
        remove: function (req, res) {
            var that = this;
            var id = routeHelper.findIdFromPath(req.url);
            collection.remove(id).then(function () {
                res.status(routeHelper.StatusCode.NO_CONTENT).end();
            }, function (err) {
                routeHelper.setErrorStatus(res, err);
            });
        }
    };
}

module.exports = restInterfaces;