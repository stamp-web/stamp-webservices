const extend = require('node.extend');
const fieldDefinition = require('./field-definition');
const country = require('./country');

const stamp = extend({}, fieldDefinition, function () {
    return {
        getFieldDefinitions: function () {
            return [
                {field: 'id', column: 'ID', type: 'long', required: true},
                {field: 'rate', column: 'DENOMINATION', type: 'string', required: true},
                {field: 'description', column: 'DESCRIPTION', type: 'string'},
                {field: 'catalogueCount', column: 'CATALOGUE_COUNT', type: 'int', internal: true},
                {
                    field: 'countryRef',
                    column: 'COUNTRY_ID',
                    type: 'long',
                    required: true,
                    joinWith: 'COUNTRIES',
                    sortFn: this.sortByCountry
                },
                {field: 'wantList', type: 'boolean', column: 'WANTLIST'},
                {field: 'catalogueCount', column: 'CATALOGUE_COUNT', type: 'int', internal: true},
                {field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true},
                {field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true},
                {field: 'catalogueNumbers', column: 'CATALOGUENUMBER', type: 'obj_array', model: 'catalogue-number'},
                {field: 'stampOwnerships', column: 'OWNERSHIP', type: 'obj_array', model: 'ownership'}
            ];
        },
        getSequenceColumn: function () {
            return "STAMP_ID";
        },
        getTableName: function () {
            return "STAMPS";
        },
        getAlias: function () {
            return "s";
        },
        sortByCountry: function () {
            return country.getAlias() + '.NAME';
        }

    };
}());

module.exports = stamp;
