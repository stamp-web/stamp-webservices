const extend = require('node.extend');
const EntityManagement = require('./entity-management');
const PersistentCollection = require('./persistent-collection');
const dataTranslator = require('./mysql-translator');
const country = require('../model/country');
const ownership = require('../model/ownership');
const stamp = require('../model/stamp');


const countries = extend(true, {}, new EntityManagement(), new PersistentCollection(), function () {
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

module.exports = countries;
