var _ = require('../../lib/underscore/underscore');
var q = require('q');
var connectionManager = require('../pom/connection-mysql');
var dataTranslator = require('./mysql-translator');
var odata = require('../util/odata-parser');
var stamp = require('../model/stamp');
var catalogue = require('../model/catalogue');
var ownership = require('../model/ownership');
var catalogueNumber = require('../model/catalogue-number');
var logger = require('../util/logger');
var fx = require('money');
var accounting = require('accounting');
var http = require('http');
var fs = require('fs');
var nconf = require('nconf');

nconf.argv().env().file(__dirname + '/../../config/application.json');

var report = function () {
    var TIME_INTERVAL = 60 * 60 * 6 * 1000; // 6 hours
    var initialized = false;
    var initialize = function (callback) {
        
        var filename = __dirname + '/../../config/exchange-rates.json';
        
        var configureFx = function (data) {
            if (data) {
                if (typeof fx !== "undefined" && fx.rates) {
                    fx.rates = data.rates;
                    fx.base = data.base;
                } else {
                    // If not, apply to fxSetup global:
                    window.fxSetup = {
                        rates : data.rates,
                        base : data.base
                    }
                }
                initialized = true;
                callback();
            }
        };
    
        

        fs.exists(filename, function (exists) {
            var getNew = !exists;
            var exchangeData = {};
            if (exists) {
                getNew = false;
                var data = fs.readFileSync(filename, { encoding: 'UTF-8' });
                exchangeData = JSON.parse(data);
                if (!exchangeData.lastUpdated || new Date().getTime() - exchangeData.lastUpdated > TIME_INTERVAL) {
                    getNew = true;
                }
            }
            if (getNew) {
                var chunks = "";
                var appId = nconf.get("openexchangerates.org")["app_id"];
                if (!appId) {
                    logger.log(logger.WARN, "No app_id found for openexchangerates.org so no new rates can be obtained.");
                } else {
                    logger.log(logger.INFO, "Fetching rates from openexchangerates.org");
                    http.get('http://openexchangerates.org/api/latest.json?app_id=' + appId, function (res) {
                        if (res.statusCode === 200) {
                            res.on('data', function (chunk) {
                                chunks += chunk;
                            });
                            res.on('end', function () {
                                exchangeData = JSON.parse(chunks);
                                exchangeData.lastUpdated = new Date().getTime();
                                fs.writeFile(filename, JSON.stringify(exchangeData), function (err) {
                                    configureFx(exchangeData);
                                });
                            });
                        } else {
                            logger.log(logger.ERROR, "Open Exchange responded with status code " + res.statusCode);
                        }
                    });
                }
            } else {
                configureFx(exchangeData);
            }
        }); // end exists
        
    };
    
    
    return {
        getCatalogueTotal: function ($filter, currency) {
            var defer = q.defer();
            connectionManager.getConnection("reports").then(function (connection) {
                var sql = "SELECT cv.CURRENCY, SUM(c.CATALOGUEVALUE) AS VALUE FROM " + stamp.getTableName() + ' AS s ';
                sql += 'JOIN ' + catalogueNumber.getTableName() + ' AS c ON s.ID=c.STAMP_ID ';
                sql += "LEFT JOIN " + catalogue.getTableName() + ' AS cv ON c.CATALOGUE_REF = cv.ID ';
                sql += "WHERE c.active=1 AND ";
                var whereClause = ($filter) ? dataTranslator.toWhereClause($filter, [stamp, catalogueNumber, catalogue], ['s','c','cv']) : '';
                if (whereClause.length > 0) {
                    sql += whereClause + " ";
                }
                sql += "GROUP BY c.CATALOGUE_REF";
                logger.log(logger.DEBUG, sql);
                var query = connection.query(sql, function (err, results) {
                    if (err) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    }
                    var processResults = function () {
                        var sum = 0.0;
                        _.each(results, function (result) {
                            sum += fx.convert(result.VALUE, { from: result.CURRENCY, to: currency });
                        });
                        var value = accounting.toFixed(sum, 2);
                        defer.resolve(value);
                    }
                    if (!initialized) {
                        initialize(processResults);
                    } else {
                        processResults;
                    }
                });
            });
            return defer.promise;
        },
        getCostBasis: function ($filter, currency) {
            var defer = q.defer();
            defer.resolve(20.0);
            return defer.promise;
        },
        getCashValue: function ($filter, currency) {
            var defer = q.defer();
            defer.resolve(10.0);
            return defer.promise;
        }
    };
}();

module.exports = report;
