let extend = require('node.extend');
let PersistentCollection = require('./persistent-collection');
let stamps = require('./stamps');
let catalogues = require('./catalogues');
let dataTranslator = require('./mysql-translator');
let catalogueNumber = require('../model/catalogue-number');
let catalogueNumberHelper = require('../model/catalogue-number-helper');
let _ = require('lodash');

let Logger = require('../util/logger');
let connectionManager = require('../pom/connection-mysql');

let catalogueNumberService = extend(true, {}, new PersistentCollection(), function () {
    let logger = Logger.getLogger("server");
    let sqlTrace = Logger.getLogger("sql");

    // eslint-disable-next-line no-unused-vars
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

        // eslint-disable-next-line no-unused-vars
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
                    connection.beginTransaction(() => {
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
         * @returns {Promise|*}
         */
        makeActive: function(id) {
            return new Promise((resolve, reject) => {
                this.findById(id).then(catNum => {
                    stamps.findById(catNum.STAMP_ID).then(stamp => {
                        catNum = _.find(stamp.CATALOGUENUMBER, {ID: +id});
                        let activeCN = _.find(stamp.CATALOGUENUMBER, {ACTIVE:1});
                        if( !activeCN || +activeCN.ID !== +id ) {
                            let count = 0;
                            let total = activeCN ? 2 : 1;
                            connectionManager.getConnection().then(connection => {
                                connection.beginTransaction(() => {
                                    let updateFn = (connection,id,isActive) => {
                                        let sql = "UPDATE " + catalogueNumber.getTableName() + " SET ACTIVE=" + (isActive ? 1 : 0) + ",MODIFYSTAMP=CURDATE() WHERE ID=" + id;
                                        sqlTrace.debug(sql);
                                        connection.query(sql, (err) => {
                                            if (!PersistentCollection.rollbackOnError(connection, reject, err)) {
                                                count++;
                                                if( count === total ) {
                                                    connection.commit(err => {
                                                        connection.release();
                                                        if (err) {
                                                            reject(dataTranslator.getErrorMessage(err));
                                                        }
                                                        resolve(stamp);
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
                            resolve(stamp);
                        }
                    });
                }).catch(err => {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });

        },
        collectionName: 'catalogueNumbers',
        fieldDefinition: catalogueNumber
    };
}());

module.exports = catalogueNumberService;
