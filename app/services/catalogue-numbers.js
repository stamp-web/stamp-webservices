let extend = require('node.extend');
let PersistentCollection = require('./persistent-collection');
let stamps = require('./stamps');
let catalogues = require('./catalogues');
let dataTranslator = require('./mysql-translator');
let catalogueNumber = require('../model/catalogue-number');
let catalogueNumberHelper = require('../model/catalogue-number-helper');
let _ = require('lodash');
let q = require('q');
let Logger = require('../util/logger');
let connectionManager = require('../pom/connection-mysql');

let catalogueNumberService = extend(true, {}, new PersistentCollection(), function () {
    "use strict";

    let logger = Logger.getLogger("server");
    let sqlTrace = Logger.getLogger("sql");

    let cachedCatalogues;
    let cachePolicy = true;

    const getCatalogues = () => {
        return catalogues.find();
    }

    return {

        setCachePolicy: val => {
            cachePolicy = val;
        },

        preCreate: async provided => {
            let catResult = await getCatalogues();
            let cats = catResult.rows;
            provided.NUMBERSORT = catalogueNumberHelper.serialize(provided, cats);
            return Promise.resolve();
        },

        preCommitUpdate: async (connection, merged, storedObj) => {
            let results = await getCatalogues();
            let cats = results.rows;
            merged.NUMBERSORT = catalogueNumberHelper.serialize(merged, cats);
            return Promise.resolve({
                modified: true
            });
        },

        /**
         * Bulk update the catalogue numbers based on a number sort change
         *
         * @param cns
         * @returns {Promise}
         */
        bulkUpdate: cns => {
            let sql = 'INSERT INTO CATALOGUENUMBERS (ID,NUMBER,NUMBERSORT) VALUES ';
            _.each(cns, (cn, i) => {
                sql += '(' + cn.id + ', \'' + cn.number + '\', \'' + cn.numberSort + '\')' + (i < cns.length -1 ? ', ': '');
            });
            sql += ' ON DUPLICATE KEY UPDATE ID=VALUES(ID), NUMBER=VALUES(NUMBER), NUMBERSORT=VALUES(NUMBERSORT)';
            return new Promise((resolve, reject) => {
                connectionManager.getConnection().then(connection => {
                    connection.beginTransaction((err) => {
                        connection.query(sql, (err, rows) => {
                            if (!PersistentCollection.rollbackOnError(connection, reject, err)) {
                                if (rows.changedRows === 0 && rows.affectedRows === 0) {
                                    connection.rollback(() => {
                                        connection.release();
                                        reject({
                                            message:   "No changes made during update.",
                                            code:      "NO_CHANGES",
                                            processed: true
                                        });
                                    });
                                } else {
                                    connection.commit(err => {
                                        connection.release();
                                        if (err) {
                                            reject(dataTranslator.getErrorMessage(err));
                                        } else {
                                            resolve(rows.changedRows);
                                        }
                                    });
                                }
                            }
                        });
                    });
                });
            });

        },

        /**
         * Set the catalogue number identified by id to be the active catalogue number.
         *
         * @param id The id to set as active
         * @returns {defer.promise|*}
         */
        makeActive: function(id) {
            let defer = q.defer();
            let that = this;
            this.findById(id).then(function(catNum) {
                stamps.findById(catNum.STAMP_ID).then(function(stamp) {
                    catNum = _.find(stamp.CATALOGUENUMBER, {ID: +id});
                    let activeCN = _.find(stamp.CATALOGUENUMBER, {ACTIVE:1});
                    if( !activeCN || +activeCN.ID !== +id ) {
                        let count = 0;
                        let total = activeCN ? 2 : 1;
                        connectionManager.getConnection().then(function (connection) {
                            connection.beginTransaction(function (err) {
                                let updateFn = function(connection,id,isActive) {
                                    let sql = "UPDATE " + catalogueNumber.getTableName() + " SET ACTIVE=" + (isActive ? 1 : 0) + ",MODIFYSTAMP=CURDATE() WHERE ID=" + id;
                                    sqlTrace.debug(sql);
                                    connection.query(sql, function(err,result) {
                                        if (!PersistentCollection.rollbackOnError(connection, defer, err)) {
                                            count++;
                                            if( count === total ) {
                                                connection.commit(function (err) {
                                                    connection.release();
                                                    if (err) {
                                                        defer.reject(dataTranslator.getErrorMessage(err));
                                                    }
                                                    defer.resolve(stamp);
                                                });
                                            }
                                        }
                                    });
                                };
                                catNum.ACTIVE = 1;
                                updateFn(connection,+id,true);
                                if( activeCN) {
                                    activeCN.ACTIVE = 0;
                                    updateFn(connection,+activeCN.ID,false);
                                }
                            });
                        });
                    } else {
                        logger.warn("The catalogue number with ID " + id + " was already active.");
                        defer.resolve(stamp);
                    }
                });
            }).catch(function(err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        },
        collectionName: 'catalogueNumbers',
        fieldDefinition: catalogueNumber
    };
}());

module.exports = catalogueNumberService;
