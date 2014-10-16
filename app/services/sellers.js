var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var seller = require('../model/seller');
var q = require('q');

var sellers = extend(true, {}, persistentCollection, function () {
    return {
        collectionName: 'sellers',
        fieldDefinition: seller
    };
}());

module.exports = sellers;
