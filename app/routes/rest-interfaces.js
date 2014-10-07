var url = require('url');
var _ = require('../../lib/underscore/underscore');
var odata = require('../util/odata-parser');
var logger = require('../util/logger');

function restInterfaces() {
    var StatusCode = {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        NOT_FOUND: 404,
        CONFLICT: 409,
        INTERNAL_ERROR: 500
    };
    var ClientMessages = {
        INTERNAL_ERROR: "An unexpected error occured on the server."
    };
    var ContentType = {
        JSON: "application/json",
        TEXT: "text/plain"
    };
    var Headers = {
        CONTENT_TYPE: "Content-Type"
    };
    var findIdFromPath = function (urlPath) {
        var path = url.parse(urlPath).pathname;
        var last = path.lastIndexOf("/");
        var id = +path.substring(path.lastIndexOf('/') + 1);
        return id;
    };
    var setErrorStatus = function (res, err) {
        var code = StatusCode.INTERNAL_ERROR;
        switch (err.code) {
            case "UNIQUENESS_EXCEPTION":
                code = StatusCode.CONFLICT;
                break;
            case "REQUIRED_FIELD":
                code = StatusCode.BAD_REQUEST;
                break;
            case "NOT_FOUND":
                code = StatusCode.NOT_FOUND;
                break;
        }
        res.status(code).send(err.message);
    };
    return {
        findById: function (req, res, collection, field) {
            var that = this;
            var id = findIdFromPath(req.url);
            collection.findById(id).then(function (row) {
                if (row !== null) {
                    var data = field.externalize(row);
                    res.set(Headers.CONTENT_TYPE, ContentType.JSON);
                    res.status(StatusCode.OK);
                    res.send(JSON.stringify(data));
                } else {
                    res.status(StatusCode.NOT_FOUND).end();
                }
            }, function (err) {
                res.status(StatusCode.INTERNAL_ERROR).send(ClientMessages.INTERNAL_ERROR);
            });
        },
        update: function (req, res, collection, field) {
            var that = this;
            var id = findIdFromPath(req.url);
            collection.update(req.body, id).then(function (obj) {
                res.set(Headers.CONTENT_TYPE, ContentType.JSON);
                res.status(StatusCode.OK);
                var data = field.externalize(obj);
                res.send(JSON.stringify(data));
            }, function (err) {
                logger.log(logger.ERROR, err);
                setErrorStatus(res, err);
            });
        },
        create: function (req, res, collection, field) {
            var that = this;
            collection.create(req.body).then(function (obj) {
                res.set(Headers.CONTENT_TYPE, ContentType.JSON);
                res.status(StatusCode.CREATED);
                var data = field.externalize(obj);
                res.send(JSON.stringify(data));
            }, function (err) {
                logger.log(logger.ERROR, err);
                setErrorStatus(res, err);
            });
    
        },
        count: function (req, res, collection, field) {
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
                res.status(StatusCode.INTERNAL_ERROR).send(ClientMessages.INTERNAL_ERROR).end();
            });
        },
        find: function (req, res, collection, field) {
            var filter = (req.query && req.query.$filter) ? odata.toPredicates(req.query.$filter) : null;
            var that = this;
            collection.find(filter).then(function (rows) {
                var result = {
                    total: rows.length
                };
                result[collection.collectionName] = [];
                
                _.each(rows, function (row) {
                    result[collection.collectionName].push(field.externalize(row));
                });
                
                res.set(Headers.CONTENT_TYPE, ContentType.JSON);
                res.status(StatusCode.OK);
                res.json(result);
            }, function (err) {
                res.status(StatusCode.INTERNAL_ERROR).send(ClientMessages.INTERNAL_ERROR).end();
            });
        },
        remove: function (req, res, collection) {
            var that = this;
            var id = findIdFromPath(req.url);
            collection.remove(id).then(function () {
                res.status(StatusCode.NO_CONTENT).end();
            }, function (err) {
                setErrorStatus(res, err);
            });
        }
    };
}

module.exports = new restInterfaces();