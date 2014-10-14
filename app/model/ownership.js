var extend = require('node.extend');
var fieldDefinition = require('./field-definition');

var ownership = extend({}, fieldDefinition, function() {
        return {
        getFieldDefinitions: function () {
            return [
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'pricePaid', column: 'PRICE', type: 'float' },
                { field: 'purchased', column: 'PURCHASED', type: 'date', externalizeOnEmpty: false},
                { field: 'grade', column: 'GRADE', type: 'int' },
                { field: 'condition', column: 'THECONDITION', type: 'int' },
                { field: 'img', column: 'IMAGE', type: 'string' },
                { field: 'notes', column: 'NOTES', type: 'string', externalizeOnEmpty: false },
                { field: 'code', column: 'CURRENCY', type: 'string' },
                { field: 'stampRef', column: 'STAMP_ID', type: 'long', required: true, joinWith: 'STAMPS', internal: true },
                { field: 'albumRef', column: 'ALBUM_ID', type: 'long', joinWith: 'ALBUMS' },
                { field: 'defects', column: 'DEFECTS', type: 'int' },
                { field: 'deception', column: 'DECEPTION', type: 'int' },
                { field: 'sellerRef', column: 'SELLER_ID', type: 'long', joinWith: 'SELLERS' },
                { field: 'cert', column: 'CERTIFIED', type: 'boolean' },
                { field: 'certImg', column: 'CERTIFIED_IMAGE', type: 'string', externalizeOnEmpty: false },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true }
            ];
        },
        getSequenceColumn: function () {
            return "OWNERSHIP_ID";
        },
        getTableName: function () {
            return "OWNERSHIP";
        }

    };
}());

module.exports = ownership;
