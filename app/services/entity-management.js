var connectionManager = require('../pom/connection-mysql');
var dataTranslator = require('./mysql-translator');
var stamp = require('../model/stamp');

var Logger = require('../util/logger');


var q = require('q');

function EntityManagement() {
    "use strict";

    var sqlTrace = Logger.getLogger('sql');

    return {
        getCountStampWhereStatement: function() {
            throw new Error("Not implemented");
        },
        getCountStampFromTables: function() {
            return this.fieldDefinition.getTableName() +
                ' AS ' + this.fieldDefinition.getAlias() + ',' + stamp.getTableName() + ' AS ' + stamp.getAlias();
        },
        countStamps: function() {
            var defer = q.defer();
            var qs = 'SELECT ' + this.fieldDefinition.getAlias() + '.ID AS ID, COUNT(' + stamp.getAlias() + '.ID) AS COUNT FROM ' + this.getCountStampFromTables() + ' WHERE ' +
                this.getCountStampWhereStatement() + ' GROUP BY ' + this.fieldDefinition.getAlias() + '.ID';
            sqlTrace.debug(qs);
            connectionManager.getConnection().then(function (connection) {
                connection.query(qs, function (err, result) {
                    connection.release();
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else if (result.length > 0) {
                        defer.resolve(result);
                    } else {
                        defer.reject({ message: "No object found", code: "NOT_FOUND", processed: true });
                    }
                });
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        }
    }
};

module.exports = EntityManagement;