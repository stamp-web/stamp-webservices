const extend = require('node.extend');
const PersistentCollection = require('./persistent-collection');
const connectionManager = require('../pom/connection-mysql');
const dataTranslator = require('./mysql-translator');
const ownership = require('../model/ownership');
const stamp = require('../model/stamp');
const catalogue = require('../model/catalogue');
const catalogueNumber = require('../model/catalogue-number');
const Logger = require('../util/logger');
const ExchangeRates = require('../util/exchange-rates');
const fx = require('money');
const accounting = require('accounting');
const _ = require('lodash');

const ownershipService = extend(true, {}, new PersistentCollection(), function () {
    const sqlTrace = Logger.getLogger("sql");
    const serverLog = Logger.getLogger("server");

    ExchangeRates.checkRates(() => {
        serverLog.info('rates are retrieved for ownership.');
    });

    function buildCatalogueValueQuery(stampList) {
        let cnA = catalogueNumber.getAlias();
        let sA = stamp.getAlias();
        let qs = `SELECT ${stamp.getAlias()}.ID AS STAMP_ID,
                         ${ownership.getAlias()}.ID,
                         ${catalogueNumber.getAlias()}.CATALOGUEVALUE,
                         ${catalogue.getAlias()}.CURRENCY
                  FROM  ` +
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
        let qs = `UPDATE ${ownership.getTableClause()} INNER JOIN ${stamp.getTableClause()}
                  SET ` +
            `${oA}.MODIFYSTAMP=CURDATE(),${oA}.PRICE=${price},${oA}.CURRENCY='${currencyCode}',` +
            `${sA}.MODIFYSTAMP=CURDATE() WHERE ${sA}.ID=${result.STAMP_ID} AND ${oA}.ID=${result.ID}`;
        sqlTrace.debug('update price paid query=', qs);
        return qs;
    }

    function sumCatalogueValue(queryResult, targetCurrency) {
        let sum = 0.0;
        _.forEach(queryResult, result => {
            if (result.CATALOGUEVALUE > 0) {
                sum += fx.convert(result.CATALOGUEVALUE, {from: result.CURRENCY, to: targetCurrency});
            }
        });
        sum = accounting.toFixed(sum, 2);
        return sum;
    }

    return {
        collectionName: 'stampOwnerships',
        fieldDefinition: ownership,

        purchase: (stamps, pricePaid, currencyCode) => {
            return new Promise((resolve, reject) => {
                connectionManager.getConnection().then(connection => {
                    let query = buildCatalogueValueQuery(stamps);
                    connection.query(query, (err, queryResult) => {
                        let sum = sumCatalogueValue(queryResult, currencyCode);
                        let ratio = pricePaid / sum;
                        let total = _.size(queryResult);
                        let processed = 0

                        connection.beginTransaction(() => {
                            _.forEach(queryResult, (result) => {
                                const handleProcessing = () => {
                                    if (processed === total) {
                                        connection.commit(err => {
                                            connection.release();
                                            if (err) {
                                                reject(dataTranslator.getErrorMessage(err));
                                            }
                                            resolve();
                                        });
                                    }
                                }
                                if (result.CATALOGUEVALUE > 0) {
                                    let sql = buildUpdateQuery(result, currencyCode, ratio);
                                    connection.query(sql, err => {
                                        if (!PersistentCollection.rollbackOnError(connection, reject, err)) {
                                            processed++;
                                            handleProcessing()
                                        }
                                    });

                                } else {
                                    processed++
                                    handleProcessing()
                                }
                            });
                        }); // end beginTranscation
                    });
                }, err => {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });

        }

    };
}());

module.exports = ownershipService;
