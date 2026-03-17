import extend from 'node.extend';
import PersistentCollection from './persistent-collection.js';
import EntityManagement from './entity-management.js';
import dataTranslator from './mysql-translator.js';
import catalogue from '../model/catalogue.js';
import stamp from '../model/stamp.js';
import catalogueNumber from '../model/catalogue-number.js';
import Logger from '../util/logger.js';

const sqlTrace = Logger.getLogger('sql');

const catalogueService = extend(true, {}, new EntityManagement(), new PersistentCollection(), function () {

    return {
        getCountStampWhereStatement: function() {
            return catalogueNumber.getAlias() + '.ACTIVE=1 AND ' + stamp.getAlias() + '.ID=' + catalogueNumber.getAlias() + '.STAMP_ID AND ' + catalogueNumber.getAlias() + '.CATALOGUE_REF=' + catalogue.getAlias() + '.ID';
        },

        getCountStampFromTables: function() {
            return this.fieldDefinition.getTableClause() + ',' + stamp.getTableClause() + ',' + catalogueNumber.getTableClause();
        },
        preDelete: function (connection, id) {
            return new Promise((resolve, reject) => {
                let qs = 'SELECT COUNT(%a%.ID) AS COUNT FROM ' + catalogueNumber.getTableName() + ' AS %a% where %a%.CATALOGUE_REF=? AND %a%.ACTIVE=1';
                qs = qs.replace(new RegExp('%a%','g'),catalogueNumber.getAlias());
                sqlTrace.debug(qs);
                connection.query(qs, [id], (err, results) => {
                    if (err !== null) {
                        reject(dataTranslator.getErrorMessage(err));
                    } else {
                        if( results[0].COUNT > 0 ) {
                            reject({ message: "Stamps would be orphaned if the catalogue was deleted.", code: "CONFLICT", processed: true });
                        } else {
                            resolve();
                        }
                    }
                });
            });

        },
        collectionName: 'catalogues',
        fieldDefinition: catalogue
    };
}());

export default catalogueService;