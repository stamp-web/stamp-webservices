var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var country = require('../model/country');
var stamp = require('../model/stamp');
var stampService = require('./stamps');
var dataTranslator = require('./mysql-translator');
var odata = require('../util/odata-parser');
var q = require('q');
var _ = require('../../lib/underscore/underscore');
var Logger = require('../util/logger');

var sqlTrace = Logger.getLogger("sql");

var countries = extend(true, {}, new PersistentCollection(), function() {
    "use strict";
    return {
        collectionName: 'countries',
        fieldDefinition: country
    };
}());

module.exports = countries;
