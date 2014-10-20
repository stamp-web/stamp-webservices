var _ = require('../../lib/underscore/underscore');
var q = require('q');
var connectionManager = require('../pom/connection-mysql');
var dataTranslator = require('./mysql-translator');
var stamp = require('../model/stamp');
var catalogue = require('../model/catalogue');
var ownership = require('../model/ownership');
var catalogueNumber = require('../model/catalogue-number');
var Logger = require('../util/logger');
var ExchangeRates = require('../util/exchange-rates');
var fx = require('money');
var accounting = require('accounting');

var sqlTrace = Logger.getLogger("sql");
var logger = Logger.getLogger("server");

var report = function () {
    "use strict";
    return {
        getCatalogueTotal: function ($filter, currency) {
            var defer = q.defer();
            connectionManager.getConnection("reports").then(function (connection) {
                var sql = "SELECT " + catalogue.getAlias() + ".CURRENCY, SUM(" + catalogueNumber.getAlias() + ".CATALOGUEVALUE) AS VALUE ";
                sql += "FROM " + stamp.getTableName() + ' AS ' + stamp.getAlias() + ' ';
                sql += 'JOIN ' + catalogueNumber.getTableName() + ' AS ' + catalogueNumber.getAlias() + ' ON ' + stamp.getAlias() + '.ID=' + catalogueNumber.getAlias() + '.STAMP_ID ';
                sql += "LEFT JOIN " + ownership.getTableName() + ' AS ' + ownership.getAlias() + ' ON ' + stamp.getAlias() + '.ID=' + ownership.getAlias() + '.STAMP_ID ';                
                sql += "LEFT JOIN " + catalogue.getTableName() + ' AS ' + catalogue.getAlias() + ' ON ' + catalogueNumber.getAlias() + '.CATALOGUE_REF = ' + catalogue.getAlias() + '.ID ';
                sql += "WHERE " + catalogueNumber.getAlias() + ".active=1 ";
                var whereClause = ($filter) ? dataTranslator.toWhereClause($filter, [stamp, catalogueNumber, catalogue, ownership]) : '';
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
                    };
                    ExchangeRates.checkRates(processResults);
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
