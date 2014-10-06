var _ = require('../../lib/underscore/underscore');
var q = require('q');
var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var preference = require('../model/preference');

var preferences = extend(true, {}, persistentCollection, function() {
    return {
        collectionName: 'preferences',
        fieldDefinition: preference
    };
}());

module.exports = preferences;
