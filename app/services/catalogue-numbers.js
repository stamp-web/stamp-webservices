var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var stamps = require('./stamps');
var dataTranslator = require('./mysql-translator');
var catalogueNumber = require('../model/catalogue-number');
var _ = require('lodash');
var q = require('q');
var Logger = require('../util/logger');
var connectionManager = require('../pom/connection-mysql');

var logger = Logger.getLogger("server");
var sqlTrace = Logger.getLogger("sql");

var catalogueNumberService = extend(true, {}, new PersistentCollection(), function () {
    "use strict";
    return {
        /**
         * Set the catalogue number identified by id to be the active catalogue number.
         *
         * @param id The id to set as active
         * @returns {defer.promise|*}
         */
        makeActive: function(id) {
            var defer = q.defer();
            var that = this;
            this.findById(id).then(function(catNum) {
                stamps.findById(catNum.STAMP_ID).then(function(stamp) {
                    catNum = _.findWhere(stamp.CATALOGUENUMBER, {ID: +id});
                    var activeCN = _.findWhere(stamp.CATALOGUENUMBER, {ACTIVE:1});
                    if( !activeCN || +activeCN.ID !== +id ) {
                        var count = 0;
                        var total = activeCN ? 2 : 1;
                        connectionManager.getConnection().then(function (connection) {
                            connection.beginTransaction(function (err) {
                                var updateFn = function(connection,id,isActive) {
                                    var sql = "UPDATE " + catalogueNumber.getTableName() + " SET ACTIVE=" + (isActive ? 1 : 0) + ",MODIFYSTAMP=CURDATE() WHERE ID=" + id;
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
