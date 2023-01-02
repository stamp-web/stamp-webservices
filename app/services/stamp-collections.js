var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var EntityManagement = require('./entity-management');
var dataTranslator = require('./mysql-translator');
var Predicate = require('odata-filter-parser').Predicate;
var Operators = require('odata-filter-parser').Operators;
var stampCollection = require('../model/stamp-collection');
var album = require('../model/album');
var stamp = require('../model/stamp');
var ownership = require('../model/ownership');
var albums = require('./albums');

var _ = require('lodash');

var collections = extend(true, {},  new EntityManagement(), new PersistentCollection(), function() {
    "use strict";
    return {
        collectionName: 'stampCollections',
        fieldDefinition: stampCollection,

        getCountStampWhereStatement: function() {
            return album.getAlias() + '.COLLECTION_ID=' + this.fieldDefinition.getAlias() + '.ID AND ' +
                ownership.getAlias() + '.ALBUM_ID = ' + album.getAlias() + '.ID AND ' + ownership.getAlias() + '.STAMP_ID=' +
                stamp.getAlias() + '.ID';
        },

        getCountStampFromTables: function() {
            return this.fieldDefinition.getTableClause() + ',' + stamp.getTableClause() + ',' +
                ownership.getTableClause() + ',' + album.getTableClause();

        },

        /**
         * Will pre-delete the album(s) for the stamp collection.
         * 
         * @param connection    The sql connection
         * @param id            The id of the collection to delete
         * 
         * @return promise of success
         */
        preDelete: function (connection, id) {
            return new Promise((resolve, reject) => {
                var params = {
                    $filter : new Predicate({
                        subject: _.find(album.getFieldDefinitions(), { column: "COLLECTION_ID" }).field,
                        operator: Operators.EQUALS,
                        value: id
                    }),
                    $limit: 1000,
                    $offset: 0,
                    $orderby: null
                };
                albums.find(params).then(results => {
                    let deleteCount = 0;
                    let len = results.rows.length;
                    if (len === 0) {
                        resolve();
                    } else {
                        let processRemoved = affected => {
                            if (affected > 0) {
                                deleteCount++;
                                if (deleteCount === len) {
                                    resolve();
                                }
                            }
                        };
                        let processError = err => {
                            reject(dataTranslator.getErrorMessage(err));
                        };
                        for (var i = 0; i < len; i++) {
                            let row = results.rows[i];
                            albums.remove(row.ID).then(processRemoved, processError);
                        }
                    }
                }, err => {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });
        }
    };
}());

module.exports = collections;
