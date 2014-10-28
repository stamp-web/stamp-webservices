var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var country = require('../model/country');

var countries = extend(true, {}, new PersistentCollection(), function() {
    "use strict";
    return {
        collectionName: 'countries',
        fieldDefinition: country
    };
}());

module.exports = countries;
