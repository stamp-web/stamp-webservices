import extend from 'node.extend';
import PersistentCollection from './persistent-collection.js';
import stamps from './stamps.js';
import catalogues from './catalogues.js';
import dataTranslator from './mysql-translator.js';
import catalogueNumber from '../model/catalogue-number.js';
import catalogueNumberHelper from '../model/catalogue-number-helper.js';
import _ from 'lodash';
import Logger from '../util/logger.js';
import connectionManager from '../pom/connection-mysql.js';

let logger = Logger.getLogger("server");
let sqlTrace = Logger.getLogger("sql");

// eslint-disable-next-line no-unused-vars
let cachePolicy = true;

const getCatalogues = () => {
    return catalogues.find();
}

const catalogueNumberService = extend(true, {}, new PersistentCollection(), function () {

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
         * @param {Array<{id: number, number: string, numberSort: string}>} cns
         * @returns {Promise<number>} Number of changed rows
         */
        bulkUpdate: cns => {
            if (!Array.isArray(cns) || cns.length === 0) {
                return Promise.reject({
                    message: "No changes made during update.",
                    code: "NO_CHANGES",
                    processed: true
                });
            }

            const values = cns.map(cn => [cn.id, cn.number, cn.numberSort]);
            const sql = 'INSERT INTO CATALOGUENUMBERS (ID, NUMBER, NUMBERSORT) VALUES ? ON DUPLICATE KEY UPDATE NUMBER=VALUES(NUMBER), NUMBERSORT=VALUES(NUMBERSORT)';
            sqlTrace.debug(sql + ' Bind params: ' + JSON.stringify(values));

            return new Promise((resolve, reject) => {
                connectionManager.getConnection().then(connection => {
                    connection.beginTransaction(err => {
                        if (PersistentCollection.rollbackOnError(connection, reject, err)) {
                            return;
                        }
                        connection.query(sql, [values], (err, rows) => {
                            if (!PersistentCollection.rollbackOnError(connection, reject, err)) {
                                if (rows.changedRows === 0 && rows.affectedRows === 0) {
                                    connection.rollback(() => {
                                        connection.release();
                                        reject({
                                            message: "No changes made during update.",
                                            code: "NO_CHANGES",
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
                }, err => {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });

        },

        /**
         * Set the catalogue number identified by id to be the active catalogue number.
         *
         * @param {number|string} id The id to set as active
         * @returns {Promise<Object|null>} The updated stamp object or null if not found
         */
        makeActive: async function(id) {
            const catNumRow = await this.findById(id);
            if (!catNumRow) {
                return null;
            }

            const stampObj = await stamps.findById(catNumRow.STAMP_ID);
            if (!stampObj) {
                return null;
            }

            const targetCatNum = _.find(stampObj.CATALOGUENUMBER, { ID: +id });
            const activeCN = _.find(stampObj.CATALOGUENUMBER, { ACTIVE: 1 });

            if (!activeCN || +activeCN.ID !== +id) {
                let connection;
                try {
                    connection = await connectionManager.getConnection();
                } catch (err) {
                    throw dataTranslator.getErrorMessage(err);
                }

                const sql = `UPDATE ${catalogueNumber.getTableName()} SET ACTIVE=?, MODIFYSTAMP=CURDATE() WHERE ID=?`;

                await new Promise((resolve, reject) => {
                    connection.beginTransaction(err => {
                        if (PersistentCollection.rollbackOnError(connection, reject, err)) {
                            return;
                        }
                        sqlTrace.debug(`${sql} Bind params: [1, ${id}]`);
                        connection.query(sql, [1, +id], err => {
                            if (PersistentCollection.rollbackOnError(connection, reject, err)) {
                                return;
                            }
                            if (activeCN) {
                                sqlTrace.debug(`${sql} Bind params: [0, ${activeCN.ID}]`);
                                connection.query(sql, [0, +activeCN.ID], err => {
                                    if (PersistentCollection.rollbackOnError(connection, reject, err)) {
                                        return;
                                    }
                                    connection.commit(err => {
                                        connection.release();
                                        if (err) {
                                            reject(dataTranslator.getErrorMessage(err));
                                        } else {
                                            resolve();
                                        }
                                    });
                                });
                            } else {
                                connection.commit(err => {
                                    connection.release();
                                    if (err) {
                                        reject(dataTranslator.getErrorMessage(err));
                                    } else {
                                        resolve();
                                    }
                                });
                            }
                        });
                    });
                });

                if (targetCatNum) {
                    targetCatNum.ACTIVE = 1;
                }
                if (activeCN) {
                    activeCN.ACTIVE = 0;
                }
            } else {
                logger.warn(`The catalogue number with ID ${id} was already active.`);
            }

            return stampObj;
        },
        collectionName: 'catalogueNumbers',
        fieldDefinition: catalogueNumber
    };
}());

export default catalogueNumberService;