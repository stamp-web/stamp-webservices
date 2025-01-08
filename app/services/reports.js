var _ = require('lodash');

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

var report = function () {
    "use strict";

    var sqlTrace = Logger.getLogger("sql");

    function generateFromTables() {
        var sql = "FROM " + stamp.getTableName() + ' AS ' + stamp.getAlias() + ' ';
        sql += 'JOIN ' + catalogueNumber.getTableName() + ' AS ' + catalogueNumber.getAlias() + ' ON ' + stamp.getAlias() + '.ID=' + catalogueNumber.getAlias() + '.STAMP_ID ';
        sql += "LEFT JOIN " + ownership.getTableName() + ' AS ' + ownership.getAlias() + ' ON ' + stamp.getAlias() + '.ID=' + ownership.getAlias() + '.STAMP_ID ';
        sql += "LEFT JOIN " + catalogue.getTableName() + ' AS ' + catalogue.getAlias() + ' ON ' + catalogueNumber.getAlias() + '.CATALOGUE_REF = ' + catalogue.getAlias() + '.ID ';
        return sql;
    }
    return {
        getCatalogueTotal: function ($filter, currency) {
            return new Promise((resolve, reject) => {
                connectionManager.getConnection("reports").then(connection => {
                    let sql = "SELECT " + catalogue.getAlias() + ".CURRENCY, SUM(" + catalogueNumber.getAlias() + ".CATALOGUEVALUE) AS VALUE ";
                    sql += generateFromTables();
                    sql += "WHERE " + catalogueNumber.getAlias() + ".ACTIVE=1 ";
                    let whereClause = ($filter) ? dataTranslator.toWhereClause($filter, [stamp, catalogueNumber, catalogue, ownership]) : '';
                    if (whereClause.length > 0) {
                        sql += "AND " + whereClause + " ";
                    }
                    sql += "GROUP BY " + catalogueNumber.getAlias() + ".CATALOGUE_REF";
                    sqlTrace.debug(sql);
                    let query = connection.query(sql, (err, results) => {
                        connection.release()
                        if (err) {
                            reject(dataTranslator.getErrorMessage(err));
                        }
                        let processResults = () => {
                            let sum = 0.0;
                            _.each(results, result => {
                                if( result.VALUE && result.VALUE > 0 ) {
                                    let cur = result.CURRENCY;
                                    if( !cur || cur === '' ) {
                                        cur = 'USD';
                                    }
                                    try {
                                        sum += fx.convert(result.VALUE, { from: cur, to: currency });
                                    } catch( fxErr ) {
                                        if (fxErr !== 'fx error') {
                                            throw fxErr;
                                        } else {
                                            sqlTrace.error(fxErr + ':' + cur + ' to ' + currency);
                                        }
                                    }
                                }
                            });
                            let value = accounting.toFixed(sum, 2);
                            resolve(value);
                        };
                        ExchangeRates.checkRates(processResults);
                    });
                });
            });

        },
        getCostBasis: function ($filter, currency) {
            return new Promise((resolve, reject) => {
                connectionManager.getConnection("reports").then(connection => {
                    var sql = "SELECT DISTINCT " + stamp.getAlias()  +".ID," + ownership.getAlias() + ".CURRENCY," + ownership.getAlias() + ".PRICE AS VALUE ";
                    sql += generateFromTables();
                    sql += "WHERE " + stamp.getAlias() + ".WANTLIST=0 ";
                    let whereClause = ($filter) ? dataTranslator.toWhereClause($filter, [stamp, catalogueNumber, catalogue, ownership]) : '';
                    if (whereClause.length > 0) {
                        sql += "AND " + whereClause + " ";
                    }
                    sqlTrace.debug(sql);
                    let query = connection.query(sql, (err, results) => {
                        connection.release()
                        if (err) {
                            reject(dataTranslator.getErrorMessage(err));
                        }
                        let processResults = () => {
                            let sum = 0.0;
                            _.each(results, result => {
                                if( result.VALUE && result.VALUE > 0 ) {
                                    let cur = result.CURRENCY;
                                    if( !cur || cur === '' ) {
                                        cur = 'USD';
                                    }
                                    try {
                                        sum += fx.convert(result.VALUE, { from: cur, to: currency });
                                    } catch( fxErr ) {
                                        if (fxErr !== 'fx error') {
                                            throw fxErr;
                                        } else {
                                            sqlTrace.error(fxErr + ':' + cur + ' to ' + currency);
                                        }
                                    }
                                }
                            });
                            let value = accounting.toFixed(sum, 2);
                            resolve(value);
                        };
                        ExchangeRates.checkRates(processResults);
                    });
                });
            });

        },
        getCashValue: function ($filter, currency) {
            return new Promise((resolve, reject) => {
                const owner = ownership.getAlias()
                const cv = catalogueNumber.getAlias()
                connectionManager.getConnection("reports").then(connection => {
                    let sql = `SELECT ${catalogue.getAlias()}.CURRENCY, SUM(${cv}.CATALOGUEVALUE) AS VALUE, `;
                    sql += `${owner}.DEFECTS, ${owner}.DECEPTION, ${owner}.GRADE `;
                    sql += generateFromTables();
                    sql += `WHERE ${cv}.ACTIVE=1 AND ${stamp.getAlias()}.WANTLIST=0 `;
                    const whereClause = ($filter) ? dataTranslator.toWhereClause($filter, [stamp, catalogueNumber, catalogue, ownership]) : '';
                    if (whereClause.length > 0) {
                        sql += `AND ${whereClause} `;
                    }
                    sql += `GROUP BY ${cv}.CATALOGUE_REF, ${owner}.DEFECTS, ${owner}.DECEPTION, ${owner}.GRADE`;
                    sqlTrace.debug(sql);
                    let query = connection.query(sql, (err, results) => {
                        connection.release()
                        if (err) {
                            reject(dataTranslator.getErrorMessage(err));
                        }
                        let processResults = () => {
                            let sum = 0.0;
                            _.each(results, result => {
                                if( result.VALUE && result.VALUE > 0 ) {
                                    let cur = result.CURRENCY;
                                    if( !cur || cur === '' ) {
                                        cur = 'USD';
                                    }
                                    try {
                                        let v = fx.convert(result.VALUE, { from: cur, to: currency });
                                        sum += ownership.getCalculatedValue(v, result.GRADE, result.DECEPTION, result.DEFECTS);
                                    } catch( fxErr ) {
                                        if (fxErr !== 'fx error') {
                                            throw fxErr;
                                        } else {
                                            sqlTrace.error(fxErr + ':' + cur + ' to ' + currency);
                                        }
                                    }
                                }
                            });
                            let value = accounting.toFixed(sum, 2);
                            resolve(value);
                        };
                        ExchangeRates.checkRates(processResults);
                    });
                });
            });
        }
    };
}();

module.exports = report;
