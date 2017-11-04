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

let logger = Logger.getLogger("server");
let sqlTrace = Logger.getLogger("sql");

let catalogueNumberService = extend(true, {}, new PersistentCollection(), function () {
    "use strict";

    const getCatalogues = async () => {
        let values = await catalogues.find();
        return values;
    }

    return {

        preCreate: async provided => {
            let catResult = await getCatalogues();
            let cats = catResult.rows;
            provided.NUMBERSORT = catalogueNumberHelper.serialize(provided, cats);
        },

        preCommitUpdate: async (connection,merged,storedObj) => {
            let catResult = await getCatalogues();
            let cats = catResult.rows;
            merged.NUMBERSORT = catalogueNumberHelper.serialize(merged, cats);
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
                    catNum = _.findWhere(stamp.CATALOGUENUMBER, {ID: +id});
                    let activeCN = _.findWhere(stamp.CATALOGUENUMBER, {ACTIVE:1});
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
