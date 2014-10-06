var extend = require('node.extend');
var fieldDefinition = require('./field-definition');

var stampCollection = extend({}, fieldDefinition, function() {
        return {
        getFieldDefinitions: function () {
            return [
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'name', column: 'NAME', type: 'string', required: true },
                { field: 'description', column: 'DESCRIPTION', type: 'string' },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true }
            ];
        },
        getSequenceColumn: function () {
            return "COLLECTION_ID";
        },
        getTableName: function () {
            return "STAMPCOLLECTIONS";
        }

    };
}());

module.exports = stampCollection;
