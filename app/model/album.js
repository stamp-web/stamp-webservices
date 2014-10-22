var extend = require('node.extend');
var fieldDefinition = require('./field-definition');

var album = extend({}, fieldDefinition, function() {
        "use strict";
        return {
        getFieldDefinitions: function () {
            return [
                { field: 'name', column: 'NAME', type: 'string', required: true },
                { field: 'description', column: 'DESCRIPTION', type: 'string', externalizeOnEmpty: false },
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'stampCollectionRef', column: 'COLLECTION_ID', type: 'long', required: true, joinWith: 'STAMPCOLLECTIONS' },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true },
                { field: 'countries', column: 'COUNTRIES', type: 'id_array' }
            ];
        },
        getSequenceColumn: function () {
            return "ALBUM_ID";
        },
        getTableName: function () {
            return "ALBUMS";
        },
        getAlias: function () {
            return "a";
        }
    };
}());

module.exports = album;
