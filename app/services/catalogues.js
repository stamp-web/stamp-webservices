const extend = require('node.extend');
const PersistentCollection = require('./persistent-collection');
const EntityManagement = require('./entity-management');
const dataTranslator = require('./mysql-translator');
const catalogue = require('../model/catalogue');
const stamp = require('../model/stamp');
const catalogueNumber = require('../model/catalogue-number');

const Logger = require('../util/logger');

const catalogueService = extend(true, {}, new EntityManagement(), new PersistentCollection(), function () {
    const sqlTrace = Logger.getLogger('sql');

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

module.exports = catalogueService;
