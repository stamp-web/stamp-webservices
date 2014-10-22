var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var ownership = require('../model/ownership');
var _ = require('../../lib/underscore/underscore');
var q = require('q');

var ownershipService = extend(true, {}, new PersistentCollection(), function () {
    "use strict";
    return {
        collectionName: 'stampOwnerships',
        fieldDefinition: ownership
    };
}());

module.exports = ownershipService;
