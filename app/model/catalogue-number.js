var extend = require('node.extend');
var fieldDefinition = require('./field-definition');

var catalogueNumber = extend({}, fieldDefinition, function() {
    "use strict";
    return {
        getFieldDefinitions: function () {
            return [
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'value', column: 'CATALOGUEVALUE', type: 'float' },
                { field: 'number', column: 'NUMBER', type: 'string' },
                { field: 'unknown', column: 'UNKNOWN_VALUE', type: 'boolean', externalizeOnEmpty: false },
                { field: 'condition', column: 'CAT_CONDITION', type: 'int' },
                { field: 'nospace', column: 'NOTAVAILABLE', type: 'boolean', externalizeOnEmpty: false },
                { field: 'active', column: 'ACTIVE', type: 'boolean' },
                { field: 'stampRef', column: 'STAMP_ID', type: 'long', required: true, joinWith: 'STAMPS', internal: true },
                { field: 'catalogueRef', column: 'CATALOGUE_REF', type: 'long', joinWith: 'CATALOGUES' },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true }
            ];
        },
        getSequenceColumn: function () {
            return "CATNUM_ID";
        },
        getTableName: function () {
            return "CATALOGUENUMBERS";
        },
        getAlias: function () {
            return "c";
        }

    };
}());

module.exports = catalogueNumber;
