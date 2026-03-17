import extend from 'node.extend';
import PersistentCollection from './persistent-collection.js';
import EntityManagement from './entity-management.js';
import dataTranslator from './mysql-translator.js';
import odataFilterParser from 'odata-filter-parser';
import stampCollection from '../model/stamp-collection.js';
import album from '../model/album.js';
import stamp from '../model/stamp.js';
import ownership from '../model/ownership.js';
import albums from './albums.js';
import _ from 'lodash';

const { Predicate, Operators } = odataFilterParser;

const collections = extend(true, {}, new EntityManagement(), new PersistentCollection(), function () {
    return {
        collectionName: 'stampCollections',
        fieldDefinition: stampCollection,

        getCountStampWhereStatement: function () {
            return album.getAlias() + '.COLLECTION_ID=' + this.fieldDefinition.getAlias() + '.ID AND ' +
                ownership.getAlias() + '.ALBUM_ID = ' + album.getAlias() + '.ID AND ' + ownership.getAlias() + '.STAMP_ID=' +
                stamp.getAlias() + '.ID';
        },

        getCountStampFromTables: function () {
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
                const params = {
                    $filter: new Predicate({
                        subject: _.find(album.getFieldDefinitions(), {column: "COLLECTION_ID"}).field,
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
                        for (let i = 0; i < len; i++) {
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

export default collections;