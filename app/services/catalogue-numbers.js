var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var catalogueNumber = require('../model/catalogue-number');
var _ = require('../../lib/underscore/underscore');
var q = require('q');

var catalogueNumberService = extend(true, {}, new PersistentCollection(), function () {

    return {
        collectionName: 'catalogueNumbers',
        fieldDefinition: catalogueNumber
    };
}());

module.exports = catalogueNumberService;
