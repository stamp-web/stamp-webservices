var _ = require('../../lib/underscore/underscore');
var q = require('q');
var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var preference = require('../model/preference');

var preferences = extend(true, {}, new PersistentCollection(), function() {
    return {
        collectionName: 'preferences',
        fieldDefinition: preference
    };
}());

module.exports = preferences;
