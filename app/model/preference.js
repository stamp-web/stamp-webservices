var extend = require('node.extend');
var fieldDefinition = require('./field-definition');

var preference = extend({}, fieldDefinition, function () {
    return {
        getFieldDefinitions: function () {
            return [
                { field: 'name', column: 'NAME', type: 'string', required: true },
                { field: 'category', column: 'CATEGORY', type: 'string', required: true },
                { field: 'value', column: 'VALUE', type: 'string' },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true },
                { field: 'id', column: 'ID', type: 'long', required: true }
            ];
        },
        getSequenceColumn: function () {
            return "PREF_ID";
        },
        getTableName: function () {
            return "PREFERENCES";
        }
    };
}());

module.exports = preference;