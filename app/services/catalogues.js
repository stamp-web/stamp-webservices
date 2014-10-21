var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var catalogue = require('../model/catalogue');
var _ = require('../../lib/underscore/underscore');
var q = require('q');

var catalogueService = extend(true, {}, new PersistentCollection(), function () {

    return {
        collectionName: 'catalogues',
        fieldDefinition: catalogue
    };
}());

module.exports = catalogueService;
