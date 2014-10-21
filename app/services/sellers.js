var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var seller = require('../model/seller');
var q = require('q');

var sellers = extend(true, {}, new PersistentCollection(), function () {
    return {
        collectionName: 'sellers',
        fieldDefinition: seller
    };
}());

module.exports = sellers;
