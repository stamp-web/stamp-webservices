var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var ownership = require('../model/ownership');

var ownershipService = extend(true, {}, new PersistentCollection(), function () {
    "use strict";
    return {
        collectionName: 'stampOwnerships',
        fieldDefinition: ownership
    };
}());

module.exports = ownershipService;
