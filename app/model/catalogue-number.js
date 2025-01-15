const extend = require('node.extend');
const fieldDefinition = require('./field-definition');

const catalogueNumber = extend({}, fieldDefinition, function () {
    return {
        getFieldDefinitions: function () {
            return [
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'value', column: 'CATALOGUEVALUE', type: 'float' },
                { field: 'number', column: 'NUMBER', type: 'string', sortFn: this.catalogueNumberSort },
                { field: 'unknown', column: 'UNKNOWN_VALUE', type: 'boolean', externalizeOnEmpty: false },
                { field: 'condition', column: 'CAT_CONDITION', type: 'int' },
                { field: 'nospace', column: 'NOTAVAILABLE', type: 'boolean', externalizeOnEmpty: false },
                { field: 'active', column: 'ACTIVE', type: 'boolean' },
                { field: 'stampRef', column: 'STAMP_ID', type: 'long', required: true, joinWith: 'STAMPS', internal: true },
                { field: 'numberSort', column: 'NUMBERSORT', type: 'string', internal: true}, // still prototype
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
        },
        catalogueNumberSort: function () {
            return this.getAlias() + '.NUMBERSORT';
        }

    };
}());

module.exports = catalogueNumber;
