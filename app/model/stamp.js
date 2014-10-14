var extend = require('node.extend');
var fieldDefinition = require('./field-definition');

var stamp = extend({}, fieldDefinition, function() {
        return {
        getFieldDefinitions: function () {
            return [
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'rate', column: 'DENOMINATION', type: 'string', required: true },
                { field: 'description', column: 'DESCRIPTION', type: 'string' },
                { field: 'catalogueCount', column: 'CATALOGUE_COUNT', type: 'int', internal: true },
                { field: 'countryRef', column: 'COUNTRY_ID', type: 'long', required: true, joinWith: 'COUNTRIES' },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true },
                { field: 'catalogueNumbers', column: 'CATALOGUENUMBER', type: 'obj_array', model: 'catalogue-number' },
                { field: 'stampOwnerships', column: 'OWNERSHIP', type: 'obj_array', model: 'ownership' }
            ];
        },
        getSequenceColumn: function () {
            return "STAMP_ID";
        },
        getTableName: function () {
            return "STAMPS";
        }

    };
}());

module.exports = stamp;
