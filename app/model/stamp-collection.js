const extend = require('node.extend');
const fieldDefinition = require('./field-definition');

const stampCollection = extend({}, fieldDefinition, function () {
    return {
        getFieldDefinitions: function () {
            return [
                {field: 'id', column: 'ID', type: 'long', required: true},
                {field: 'name', column: 'NAME', type: 'string', required: true},
                {field: 'description', column: 'DESCRIPTION', type: 'string', externalizeOnEmpty: false},
                {field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true},
                {field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true}
            ];
        },
        getSequenceColumn: function () {
            return "COLLECTION_ID";
        },
        getTableName: function () {
            return "STAMPCOLLECTIONS";
        },
        getAlias: function () {
            return "sc";
        }

    };
}());

module.exports = stampCollection;
