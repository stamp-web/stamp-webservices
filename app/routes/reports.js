const Logger = require('../util/logger');
const Authenticator = require('../util/authenticator');
const Parser = require('odata-filter-parser').Parser;
const service = require('../services/reports');
const routeHelper = require('./route-helper');

const logger = Logger.getLogger("server");

function reports() {
    return {
        executeReport: (req, res) => {
            const rType = req.query.$reportType;
            if (!rType) {
                res.status(routeHelper.StatusCode.BAD_REQUEST).send("A reportType query argument is required.").end();
                return;
            }
            const $filter = (req.query && req.query.$filter) ? Parser.parse(req.query.$filter) : null;
            const currency = req.query.code ? req.query.code : 'USD';

            const result = {
                value: 0.0,
                code: currency
            };
            res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
            let promise;
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
            promise.then(data => {
                result.value = data;
                res.status(routeHelper.StatusCode.OK);
                return res.json(result);
            }, err => {
                routeHelper.setErrorStatus(res, err);
            });
            
            
        },
        configure: function (app, basePath)  {
            app.get(basePath + "/reports", Authenticator.applyAuthentication(), this.executeReport);
            logger.debug("   Registering services at " + basePath + "/reports");
        }
    };
}

module.exports = new reports();