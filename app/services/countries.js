var extend = require('node.extend');
var EntityManagement = require('./entity-management');
var PersistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var country = require('../model/country');
var ownership = require('../model/ownership');
var stamp = require('../model/stamp');


var countries = extend(true, {}, new EntityManagement(), new PersistentCollection(), function() {
    "use strict";

    function updateImagePaths(connection,merged,storedObj) {
        return new Promise((resolve, reject) => {
            let selection = "UPDATE " + ownership.getTableName() + " " + ownership.getAlias() + " INNER JOIN " +
                stamp.getTableName() + " "  + stamp.getAlias() + " on " + ownership.getAlias() + ".STAMP_ID = " + stamp.getAlias() +
                ".ID AND " + stamp.getAlias() + ".COUNTRY_ID = " + storedObj.ID + " SET IMAGE = REPLACE(IMAGE, '" +
                storedObj.NAME + "', '" + merged.NAME + "') WHERE IMAGE LIKE '" + storedObj.NAME + "/%';";
            connection.query(selection, null, (err, results) => {
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

        getCountStampWhereStatement: function() {
            return stamp.getAlias() + '.COUNTRY_ID=' + this.fieldDefinition.getAlias() + '.ID';
        },

        preCommitUpdate: function(connection,merged,storedObj,params) {
            return new Promise((resolve, reject) => {
                if(params.modifyImagePath && params.modifyImagePath === 'true' ) {
                    updateImagePaths(connection,merged,storedObj).then(result => {
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
