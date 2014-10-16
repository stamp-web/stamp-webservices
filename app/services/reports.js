var _ = require('../../lib/underscore/underscore');
var q = require('q');
var connectionManager = require('../pom/connection-mysql');
var dataTranslator = require('./mysql-translator');
var odata = require('../util/odata-parser');
var stamp = require('../model/stamp');
var catalogue = require('../model/catalogue');
var ownership = require('../model/ownership');
var catalogueNumber = require('../model/catalogue-number');
var Logger = require('../util/logger');
var fx = require('money');
var accounting = require('accounting');
var http = require('http');
var fs = require('fs');
var nconf = require('nconf');

var sqlTrace = Logger.getLogger("sql");
var logger = Logger.getLogger("server");

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
                    logger.log(Logger.WARN, "No app_id found for openexchangerates.org so no new rates can be obtained.");
                } else {
                    logger.log(Logger.INFO, "Fetching rates from openexchangerates.org");
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
                            logger.log(Logger.ERROR, "Open Exchange responded with status code " + res.statusCode);
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
                var sql = "SELECT " + catalogue.getAlias() + ".CURRENCY, SUM(" + catalogueNumber.getAlias() + ".CATALOGUEVALUE) AS VALUE ";
                sql += "FROM " + stamp.getTableName() + ' AS ' + stamp.getAlias() + ' ';
                sql += 'JOIN ' + catalogueNumber.getTableName() + ' AS ' + catalogueNumber.getAlias() + ' ON ' + stamp.getAlias() + '.ID=' + catalogueNumber.getAlias() + '.STAMP_ID ';
                sql += "LEFT JOIN " + catalogue.getTableName() + ' AS ' + catalogue.getAlias() + ' ON ' + catalogueNumber.getAlias() + '.CATALOGUE_REF = ' + catalogue.getAlias() + '.ID ';
                sql += "WHERE " + catalogueNumber.getAlias() + ".active=1 ";
                var whereClause = ($filter) ? dataTranslator.toWhereClause($filter, [stamp, catalogueNumber, catalogue], [stamp.getAlias(),catalogueNumber.getAlias(),catalogue.getAlias()]) : '';
                if (whereClause.length > 0) {
                    sql += "AND " + whereClause + " ";
                }
                sql += "GROUP BY " + catalogueNumber.getAlias() + ".CATALOGUE_REF";
                sqlTrace.log(Logger.DEBUG, sql);
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
