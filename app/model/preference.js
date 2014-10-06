var extend = require('node.extend');
var fieldDefinition = require('./field-definition');

var preference = extend({}, fieldDefinition, function() {
        return {
        getFieldDefinitions: function () {
            return [
                {field: 'name', column: 'NAME', type: 'string', required: true},
                {field: 'category', column: 'CATEGORY', type: 'string', required: true},
                {field: 'value', column: 'VALUE', type: 'string'},
                {field: 'id', column: 'ID', type: 'long', required: true}
            ];
        },
        getTableName: function () {
            return "PREFERENCES";
        }

    };
}());

module.exports = preference;