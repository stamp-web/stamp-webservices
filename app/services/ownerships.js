var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var connectionManager = require('../pom/connection-mysql');
var q = require('q');
var ownership = require('../model/ownership');
var stamp = require('../model/stamp');
var catalogue = require('../model/catalogue');
var catalogueNumber = require('../model/catalogue-number');
var Logger = require('../util/logger');
var ExchangeRates = require('../util/exchange-rates');
var fx = require('money');
var accounting = require('accounting');

var _ = require('lodash');

var sqlTrace = Logger.getLogger("sql");
var serverLog = Logger.getLogger("server");

var ownershipService = extend(true, {}, new PersistentCollection(), function () {
    "use strict";
    ExchangeRates.checkRates(() => {
        serverLog.info('rates are retrieved for ownership.');
    });

    function buildCatalogueValueQuery(stampList) {
        let cnA = catalogueNumber.getAlias();
        let sA = stamp.getAlias();
        let qs = `SELECT ${stamp.getAlias()}.ID AS STAMP_ID,${ownership.getAlias()}.ID,${catalogueNumber.getAlias()}.CATALOGUEVALUE,${catalogue.getAlias()}.CURRENCY FROM  ` +
            `${stamp.getTableClause()}, ${ownership.getTableClause()}, ${catalogue.getTableClause()}, ${catalogueNumber.getTableClause()} WHERE ` +
            `${cnA}.STAMP_ID=${sA}.ID AND ${cnA}.ACTIVE=1 AND ${ownership.getAlias()}.STAMP_ID=${sA}.ID AND ${cnA}.CATALOGUE_REF=${catalogue.getAlias()}.ID AND ` +
            `${sA}.ID IN(${stampList.join()})`;

        sqlTrace.debug('catalogueValue query=', qs);
        return qs;
    }

    /**
     * Build an UPDATE statement that will inner join with the stamps table to update the modification timestamp
     * as well as the currency code and price on the ownership record.  The price will be a minimum of 0.01.
     *
     * @param result
     * @param currencyCode
     * @param ratio
     * @returns {string}
     */
    function buildUpdateQuery(result, currencyCode, ratio) {
        let value = fx.convert(result.CATALOGUEVALUE, {from: result.CURRENCY, to: currencyCode});
        let price = accounting.toFixed(Math.max(value * ratio, 0.01), 2);
        let oA = ownership.getAlias();
        let sA = stamp.getAlias();
        let qs = `UPDATE ${ownership.getTableClause()} INNER JOIN ${stamp.getTableClause()} SET ` +
            `${oA}.MODIFYSTAMP=CURDATE(),${oA}.PRICE=${price},${oA}.CURRENCY='${currencyCode}',` +
            `${sA}.MODIFYSTAMP=CURDATE() WHERE ${sA}.ID=${result.STAMP_ID} AND ${oA}.ID=${result.ID}`;
        sqlTrace.debug('update price paid query=', qs);
        return qs;
    }

    function sumCatalogueValue(queryResult, targetCurrency) {
        let sum = 0.0;
        _.forEach(queryResult, result => {
            sum += fx.convert(result.CATALOGUEVALUE, { from: result.CURRENCY, to: targetCurrency });
        });
        sum = accounting.toFixed(sum, 2);
        return sum;
    }

    return {
        collectionName: 'stampOwnerships',
        fieldDefinition: ownership,

        purchase: (stamps, pricePaid, currencyCode) => {
            let defer = q.defer();
            connectionManager.getConnection().then((connection) => {
                let query = buildCatalogueValueQuery(stamps);
                connection.query(query, (err, queryResult) => {
                    let sum = sumCatalogueValue(queryResult, currencyCode);
                    let ratio = pricePaid / sum;
                    let total = _.size(queryResult);
                    let processed = 0

                    connection.beginTransaction(trxErr => {
                        _.forEach(queryResult, (result, idx) => {
                            let sql = buildUpdateQuery(result, currencyCode, ratio);
                            connection.query(sql, err => {
                                if (!PersistentCollection.rollbackOnError(connection, defer, err)) {
                                    processed++;
                                    if (processed === total) {
                                        connection.commit((err) => {
                                            connection.release();
                                            if (err) {
                                                defer.reject(dataTranslator.getErrorMessage(err));
                                            }
                                            defer.resolve();
                                        });
                                    }
                                }
                            });
                        });
                    }); // end beginTranscation
                });
            }, (err) => {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        }

    };
}());

module.exports = ownershipService;
