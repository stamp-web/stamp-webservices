var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var preference = require('../model/preference');

var preferences = extend(true, {}, new PersistentCollection(), function() {
    "use strict";
    return {
        collectionName: 'preferences',
        fieldDefinition: preference
    };
}());

module.exports = preferences;
