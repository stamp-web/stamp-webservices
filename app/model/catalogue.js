var extend = require('node.extend');
var fieldDefinition = require('./field-definition');

var catalogue = extend({}, fieldDefinition, function() {
    "use strict";
    return {
        getFieldDefinitions: function () {
            return [
                { field: 'name', column: 'NAME', type: 'string', required: true },
                { field: 'description', column: 'DESCRIPTION', type: 'string', externalizeOnEmpty: false },
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'issue', column: 'ISSUE', type: 'int', required: true },
                { field: 'type', column: 'TYPE', type: 'int', require: true },
                { field: 'currency', column: 'CURRENCY', type: 'string' },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true },
                
            ];
        },
        getSequenceColumn: function () {
            return "CATALOGUE_ID";
        },
        getTableName: function () {
            return "CATALOGUES";
        },
        getAlias: function () {
            return "cv";
        }
    };
}());

module.exports = catalogue;
