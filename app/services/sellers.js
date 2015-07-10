var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var EntityManagement = require('./entity-management');
var seller = require('../model/seller');
var stamp = require('../model/stamp');
var ownership = require('../model/ownership');

var sellers = extend(true, {}, new EntityManagement(), new PersistentCollection(), function () {
    "use strict";
    return {
        collectionName: 'sellers',
        fieldDefinition: seller,

        getCountStampWhereStatement: function() {
            return ownership.getAlias() + '.SELLER_ID=' + this.fieldDefinition.getAlias() + '.ID AND ' + stamp.getAlias() + '.ID=' + ownership.getAlias() + '.STAMP_ID';
        },

        getCountStampFromTables: function() {
            return this.fieldDefinition.getTableClause() + ',' + stamp.getTableClause() + ',' + ownership.getTableClause();
        }
    };
}());

module.exports = sellers;
