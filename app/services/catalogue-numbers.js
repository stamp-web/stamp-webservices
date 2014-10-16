var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var catalogueNumber = require('../model/catalogue-number');
var _ = require('../../lib/underscore/underscore');
var q = require('q');

var catalogueNumberService = extend(true, {}, persistentCollection, function () {

    return {
        collectionName: 'catalogueNumbers',
        fieldDefinition: catalogueNumber
    };
}());

module.exports = catalogueNumberService;
