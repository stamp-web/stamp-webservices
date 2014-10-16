var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var ownership = require('../model/ownership');
var _ = require('../../lib/underscore/underscore');
var q = require('q');

var ownershipService = extend(true, {}, persistentCollection, function () {

    return {
        collectionName: 'stampOwnerships',
        fieldDefinition: ownership
    };
}());

module.exports = ownershipService;
