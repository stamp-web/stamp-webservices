var Logger = require('../util/logger');
var Authenticator = require('../util/authenticator');
var Parser = require('odata-filter-parser').Parser;
var service = require('../services/reports');
var routeHelper = require('./route-helper');

var logger = Logger.getLogger("server");

function reports() {
    "use strict";
    return {
        executeReport: function (req, res) {
            var rType = req.query.$reportType;
            if (!rType) {
                res.status(routeHelper.StatusCode.BAD_REQUEST).send("A reportType query argument is required.").end();
                return;
            }
            var $filter = (req.query && req.query.$filter) ? Parser.parse(req.query.$filter) : null;
            var currency = req.query.code ? req.query.code : 'USD';

            var result = {
                value: 0.0,
                code: currency
            };
            res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
            var promise;
            switch (rType) {
                case "CostBasis":
                    promise = service.getCostBasis($filter, currency);
                    break;
                case "CashValue":
                    promise = service.getCashValue($filter, currency);
                    break;
                default:
                    promise = service.getCatalogueTotal($filter, currency);
            }
            promise.then(function (data) {
                result.value = data;
                res.status(routeHelper.StatusCode.OK);
                res.send(JSON.stringify(result));
            }, function (err) {
                routeHelper.setErrorStatus(res, err);
            });
            
            
        },
        configure: function (app, basePath) {
            app.get(basePath + "/reports", Authenticator.applyAuthentication(), this.executeReport);
            logger.debug("   Registering services at " + basePath + "/reports");
        }
    };
}

var r = 
module.exports = new reports();