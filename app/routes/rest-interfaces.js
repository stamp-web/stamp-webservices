var _ = require('lodash');
var Parser = require('odata-filter-parser').Parser;
var Logger = require('../util/logger');
var Level = require('../util/level');
var Authenticator = require('../util/authenticator');
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

            app.get(basePath, Authenticator.applyAuthentication(), this.find);
            app.post(basePath, Authenticator.applyAuthentication(), this.create);
            app.put(basePath + "/:id", Authenticator.applyAuthentication(), this.update);
            app.get(basePath + "/!count", Authenticator.applyAuthentication(), this.count);
            app.get(basePath + "/:id", Authenticator.applyAuthentication(), this.findById);
            app.delete(basePath + '/:id', Authenticator.applyAuthentication(), this.remove);
            logger.debug("   Registering services at " + basePath);
        },
        findById: function (req, res) {
            var that = this;
            var id = req.params.id;
            collection.findById(id).then(function (row) {
                if (row !== null) {
                    var data = field.externalize(row);
                    res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                    res.status(routeHelper.StatusCode.OK);
                    res.json(data);
                } else {
                    res.status(routeHelper.StatusCode.NOT_FOUND).end();
                }
            }, function (err) {
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR);
            });
        },
        update: function (req, res) {
            var that = this;
            var id = req.params.id;
            collection.update(req.body, id, req.query).then(function (obj) {
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.OK);
                var data = field.externalize(obj);
                if(logger.isEnabled(Level.DEBUG)) {
                    logger.debug(data);
                }
                res.json(data);
            }, function (err) {
                logger.error(err);
                routeHelper.setErrorStatus(res, err);
            });
        },
        create: function (req, res) {
            var that = this;
            collection.create(req.body).then(function (obj) {
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.CREATED);
                var data = field.externalize(obj);
                if(logger.isEnabled(Level.DEBUG)) {
                    logger.debug(data);
                }
                res.json(data);
            }, function (err) {
                logger.error(err);
                routeHelper.setErrorStatus(res, err);
            });
    
        },
        count: function (req, res) {
            var params = {
                $filter : (req.query && req.query.$filter) ? Parser.parse(req.query.$filter) : null,
                $limit: req.query.$top,
                $offset: req.query.$skip,
                $orderby: req.query.$orderby
            };
            var that = this;
            collection.count(params).then(function (result) {
                res.format({
                    'text/plain': function () {
                        res.send('' + result);
                    },
                    'application/json': function () {
                        res.json({ count: result });
                    }
                });
            }, function (err) {
                logger.error(err);
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR).end();
            });
        },
        find: function (req, res) {
            var params = {
                $filter : (req.query && req.query.$filter) ? Parser.parse(req.query.$filter) : null,
                $limit: req.query.$top || 1000,
                $offset: req.query.$skip || 0,
                $orderby: req.query.$orderby || null
            };
            var that = this;
            collection.find(params).then(function (data) {
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
                logger.error(err);
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR).end();
            });
        },
        remove: function (req, res) {
            var that = this;
            var id = req.params.id;
            collection.remove(id).then(function () {
                res.status(routeHelper.StatusCode.NO_CONTENT).end();
            }, function (err) {
                routeHelper.setErrorStatus(res, err);
            });
        }
    };
}

module.exports = restInterfaces;