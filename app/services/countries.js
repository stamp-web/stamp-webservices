import extend from 'node.extend';
import EntityManagement from './entity-management.js';
import PersistentCollection from './persistent-collection.js';
import dataTranslator from './mysql-translator.js';
import country from '../model/country.js';
import ownership from '../model/ownership.js';
import stamp from '../model/stamp.js';

function updateImagePaths(connection, merged, storedObj) {
    return new Promise((resolve, reject) => {
        let selection = "UPDATE " + ownership.getTableName() + " " + ownership.getAlias() + " INNER JOIN " +
            stamp.getTableName() + " " + stamp.getAlias() + " on " + ownership.getAlias() + ".STAMP_ID = " + stamp.getAlias() +
            ".ID AND " + stamp.getAlias() + ".COUNTRY_ID = " + storedObj.ID + " SET IMAGE = REPLACE(IMAGE, '" +
            storedObj.NAME + "', '" + merged.NAME + "') WHERE IMAGE LIKE '" + storedObj.NAME + "/%';";
        connection.query(selection, null, (err) => {
            if (err) {
                reject(dataTranslator.getErrorMessage(err));
            } else {
                resolve();
            }
        });
    });
}

const countries = extend(true, {}, new EntityManagement(), new PersistentCollection(), function () {

    return {
        collectionName: 'countries',
        fieldDefinition: country,

        getCountStampWhereStatement: function () {
            return stamp.getAlias() + '.COUNTRY_ID=' + this.fieldDefinition.getAlias() + '.ID';
        },

        preCommitUpdate: function (connection, merged, storedObj, params) {
            return new Promise((resolve, reject) => {
                if (params.modifyImagePath && params.modifyImagePath === 'true') {
                    updateImagePaths(connection, merged, storedObj).then(() => {
                        resolve({
                            modified: true
                        });
                    }).catch(err => {
                        reject(dataTranslator.getErrorMessage(err));
                    });
                } else {
                    resolve({modified: false});
                }

            });
        }
    };
}());

export default countries;