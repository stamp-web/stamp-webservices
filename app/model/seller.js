var extend = require('node.extend');
var fieldDefinition = require('./field-definition');

var seller = extend({}, fieldDefinition, function() {
        return {
        getFieldDefinitions: function () {
            return [
                { field: 'name', column: 'NAME', type: 'string', required: true },
                { field: 'description', column: 'DESCRIPTION', type: 'string' },
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true },
            ];
        },
        getSequenceColumn: function () {
            return "SELLER_ID";
        },
        getTableName: function () {
            return "SELLERS";
        }
    };
}());

module.exports = seller;
