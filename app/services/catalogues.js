var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var catalogue = require('../model/catalogue');
var _ = require('../../lib/underscore/underscore');
var q = require('q');

var catalogueService = extend(true, {}, persistentCollection, function () {

    return {
        collectionName: 'catalogues',
        fieldDefinition: catalogue
    };
}());

module.exports = catalogueService;
