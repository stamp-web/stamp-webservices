import extend from 'node.extend';
import PersistentCollection from './persistent-collection.js';
import EntityManagement from './entity-management.js';
import seller from '../model/seller.js';
import stamp from '../model/stamp.js';
import ownership from '../model/ownership.js';

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

export default sellers;