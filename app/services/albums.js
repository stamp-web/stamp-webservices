var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var album = require('../model/album');
var countries = require('./countries');
var _ = require('../../lib/underscore/underscore');
var q = require('q');

var Logger = require('../util/logger');

var sqlTrace = Logger.getLogger('sql');

var albums = extend(true, {}, new PersistentCollection(), function () {

    "use strict";

    function mergeCountries(connection, obj) {

        var defer = q.defer();
        if (obj.COUNTRIES && obj.COUNTRIES.length === 0) {
            var clear_link = "DELETE FROM ALBUMS_COUNTRIES WHERE ALBUM_ID=?";
            connection.query(clear_link, [obj.ID], function (err, results) {
                if (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                } else {
                    defer.resolve(obj);
                }
            });
        } else {
            var existing_links = "SELECT COUNTRY_ID AS id FROM ALBUMS_COUNTRIES WHERE ALBUM_ID=?";
            connection.query(existing_links, [obj.ID], function (err, results) {
                if (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                } else {
                    var remove_ids = [];
                    var current = _.clone(obj.COUNTRIES);
                    for (var i = 0; i < results.length; i++) {
                        var result = results[i];
                        var indx = _.indexOf(current, result.id);
                        if (indx < 0) {
                            remove_ids.push(result.id);
                        } else {
                            current.splice(indx, 1);
                        }  
                    }
                    var totalUpdates = remove_ids.length + current.length;
                    if( totalUpdates === 0 ) {
                        defer.resolve(obj);
                    }
                    var updates = 0;

                    if (remove_ids.length > 0) {
                        var qs = "DELETE FROM ALBUMS_COUNTRIES WHERE ALBUM_ID=? AND COUNTRY_ID IN (";
                        for (var i = 0; i < remove_ids.length; i++) {
                            qs += remove_ids[i];
                            if (i < remove_ids.length - 1) {
                                qs += ",";
                            }
                        }
                        qs += ")";
                        connection.query(qs, [obj.ID], function (err, results) {
                            if (err) {
                                defer.reject(dataTranslator.getErrorMessage(err));   
                            } else {
                                updates += remove_ids.length;
                                if (totalUpdates === updates) {
                                    defer.resolve(obj);
                                }
                            }

                        });
                    }
                    if (current.length > 0) {
                        var qs = "INSERT INTO ALBUMS_COUNTRIES (ALBUM_ID,COUNTRY_ID) VALUES(?,?)";
                        for (var i = 0; i < current.length; i++) {
                            connection.query(qs, [obj.ID, current[i]], function (err, results) {
                                if (err) {
                                    defer.reject(dataTranslator.getErrorMessage(err));
                                } else {
                                    updates++;
                                    if (totalUpdates === updates) {
                                        defer.resolve(obj);
                                    }
                                }

                            });
                        }   
                    }

                }
            });
        }
        return defer.promise;
    }

    return {
        collectionName: 'albums',
        fieldDefinition: album,
        preDelete: function (connection, id) {
            var defer = q.defer();
            // TODO: Should no longer be needed with CASCADE rule
            var delete_link = "DELETE FROM ALBUMS_COUNTRIES WHERE ALBUM_ID= ?";
            connection.query(delete_link, [id], function (err, results) {
                if (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                } else {
                    // should we delete stamps?
                    defer.resolve();
                }
            });
            return defer.promise;
        },

        postCreate: function (connection, obj) {
            var defer = q.defer();
            if (obj.countries && obj.countries.length > 0) {
                _.each(obj.COUNTRIES, function (countryId) {
                    var insert_link = "INSERT INTO ALBUMS_COUNTRIES (ALBUM_ID,COUNTRY_ID) VALUES(?,?)";
                    sqlTrace.debug(insert_link);
                    connection.query(insert_link, [obj.ID,countryId], function (err, results) {
                        if (err) {
                            defer.reject(dataTranslator.getErrorMessage(err));
                        } else {
                            defer.resolve();
                        }
                    });
                });
            } else {
                defer.resolve(obj);
            }
            return defer.promise;
        },

        preCommitUpdate: function(connection,merged,storedObj) {
            var defer = q.defer();
            mergeCountries(connection,merged).then(function(result) {
                defer.resolve({
                    modified: true
                });
            }).catch(function(err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        },

        postFind: function (connection, result) {
            var that = this;
            var defer = q.defer();

            var qs = "SELECT ALBUM_ID, COUNTRY_ID FROM ALBUMS_COUNTRIES WHERE ALBUM_ID IN (";
            for (var i = 0; i < result.rows.length; i++) {
                result.rows[i].COUNTRIES = [];
                qs += result.rows[i].ID;
                if (i < result.rows.length - 1) {
                    qs += ",";
                }
            }
            qs += ")";
            connection.query(qs, function (err, r) {
                if (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                } else {
                    for (var j = 0; j < r.length; j++) {
                        var a = _.findWhere(result.rows, { ID: r[j].ALBUM_ID });
                        a.COUNTRIES.push(r[j].COUNTRY_ID);
                    }
                    defer.resolve();
                }
            });
            return defer.promise;
        }
    };
}());

module.exports = albums;
