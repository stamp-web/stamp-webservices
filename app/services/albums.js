var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var EntityManagement = require('./entity-management');
var dataTranslator = require('./mysql-translator');
var album = require('../model/album');
var countries = require('./countries');
var ownership = require('../model//ownership');
var stamp = require('../model/stamp');
var _ = require('lodash');

var albums = extend(true, {}, new EntityManagement(), new PersistentCollection(), function () {

    "use strict";

    var Logger = require('../util/logger');
    var sqlTrace = Logger.getLogger('sql');

    function mergeCountries(connection, obj) {
        return new Promise((resolve, reject) => {
            if (obj.COUNTRIES && obj.COUNTRIES.length === 0) {
                let clear_link = "DELETE FROM ALBUMS_COUNTRIES WHERE ALBUM_ID=?";
                connection.query(clear_link, [obj.ID], (err, results) => {
                    if (err) {
                        reject(dataTranslator.getErrorMessage(err));
                    } else {
                        resolve(obj);
                    }
                });
            } else {
                let existing_links = "SELECT COUNTRY_ID AS id FROM ALBUMS_COUNTRIES WHERE ALBUM_ID=?";
                connection.query(existing_links, [obj.ID], (err, results) => {
                    if (err) {
                        reject(dataTranslator.getErrorMessage(err));
                    } else {
                        let remove_ids = [];
                        let current = _.clone(obj.COUNTRIES);
                        for (let i = 0; i < results.length; i++) {
                            let result = results[i];
                            let indx = _.indexOf(current, result.id);
                            if (indx < 0) {
                                remove_ids.push(result.id);
                            } else {
                                current.splice(indx, 1);
                            }
                        }
                        let totalUpdates = remove_ids.length + current.length;
                        if( totalUpdates === 0 ) {
                            resolve(obj);
                        }
                        let updates = 0;

                        if (remove_ids.length > 0) {
                            let qs = "DELETE FROM ALBUMS_COUNTRIES WHERE ALBUM_ID=? AND COUNTRY_ID IN (";
                            for (let i = 0; i < remove_ids.length; i++) {
                                qs += remove_ids[i];
                                if (i < remove_ids.length - 1) {
                                    qs += ",";
                                }
                            }
                            qs += ")";
                            connection.query(qs, [obj.ID], (err, results) => {
                                if (err) {
                                    reject(dataTranslator.getErrorMessage(err));
                                } else {
                                    updates += remove_ids.length;
                                    if (totalUpdates === updates) {
                                        resolve(obj);
                                    }
                                }

                            });
                        }
                        if (current.length > 0) {
                            let qs = "INSERT INTO ALBUMS_COUNTRIES (ALBUM_ID,COUNTRY_ID) VALUES(?,?)";
                            for (let i = 0; i < current.length; i++) {
                                connection.query(qs, [obj.ID, current[i]], (err, results) => {
                                    if (err) {
                                        reject(dataTranslator.getErrorMessage(err));
                                    } else {
                                        updates++;
                                        if (totalUpdates === updates) {
                                            resolve(obj);
                                        }
                                    }

                                });
                            }
                        }

                    }
                });
            }
        });

    }

    return {
        collectionName: 'albums',
        fieldDefinition: album,

        getCountStampWhereStatement: function() {
            return ownership.getAlias() + '.ALBUM_ID=' + this.fieldDefinition.getAlias() + '.ID AND ' + stamp.getAlias() + '.ID=' + ownership.getAlias() + '.STAMP_ID';
        },

        getCountStampFromTables: function() {
            return this.fieldDefinition.getTableClause() + ',' + stamp.getTableClause() + ',' + ownership.getTableClause();
        },

        preDelete: function (connection, id) {
            return new Promise((resolve, reject) => {
                // TODO: Should no longer be needed with CASCADE rule
                let delete_link = "DELETE FROM ALBUMS_COUNTRIES WHERE ALBUM_ID= ?";
                connection.query(delete_link, [id], (err, results) => {
                    if (err) {
                        reject(dataTranslator.getErrorMessage(err));
                    } else {
                        // should we delete stamps?
                        resolve();
                    }
                });
            });
        },

        postCreate: function (connection, obj) {
            return new Promise((resolve, reject) => {
                if (obj.countries && obj.countries.length > 0) {
                    _.each(obj.COUNTRIES, countryId => {
                        let insert_link = "INSERT INTO ALBUMS_COUNTRIES (ALBUM_ID,COUNTRY_ID) VALUES(?,?)";
                        sqlTrace.debug(insert_link);
                        connection.query(insert_link, [obj.ID,countryId], (err, results) => {
                            if (err) {
                                reject(dataTranslator.getErrorMessage(err));
                            } else {
                                resolve();
                            }
                        });
                    });
                } else {
                    resolve(obj);
                }
            });

        },

        preCommitUpdate: function(connection,merged,storedObj) {
            return new Promise((resolve, reject) => {
                mergeCountries(connection,merged).then(result => {
                    resolve({
                        modified: true
                    });
                }).catch(err => {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });
        },

        postFind: function (connection, result) {
            return new Promise((resolve, reject) => {
                let qs = "SELECT ALBUM_ID, COUNTRY_ID FROM ALBUMS_COUNTRIES WHERE ALBUM_ID IN (";
                for (let i = 0; i < result.rows.length; i++) {
                    result.rows[i].COUNTRIES = [];
                    qs += result.rows[i].ID;
                    if (i < result.rows.length - 1) {
                        qs += ",";
                    }
                }
                qs += ")";
                connection.query(qs, (err, r) => {
                    if (err) {
                        reject(dataTranslator.getErrorMessage(err));
                    } else {
                        for (let j = 0; j < r.length; j++) {
                            let a = _.find(result.rows, { ID: r[j].ALBUM_ID });
                            a.COUNTRIES.push(r[j].COUNTRY_ID);
                        }
                        resolve();
                    }
                });
            });
        }
    };
}());

module.exports = albums;
