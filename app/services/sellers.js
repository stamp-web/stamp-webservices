const extend = require('node.extend');
const PersistentCollection = require('./persistent-collection');
const EntityManagement = require('./entity-management');
const seller = require('../model/seller');
const stamp = require('../model/stamp');
const ownership = require('../model/ownership');

const sellers = extend(true, {}, new EntityManagement(), new PersistentCollection(), function() {
    return {
        collectionName: 'sellers',
        fieldDefinition: seller,

        getCountStampWhereStatement: function() {
            return ownership.getAlias() + '.SELLER_ID=' + this.fieldDefinition.getAlias() + '.ID AND ' + stamp.getAlias() + '.ID=' + ownership.getAlias() + '.STAMP_ID';
        },

        getCountStampFromTables: function()  {
            return this.fieldDefinition.getTableClause() + ',' + stamp.getTableClause() + ',' + ownership.getTableClause();
        }
    };
}());

module.exports = sellers;
