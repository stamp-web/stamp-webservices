var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var seller = require('../model/seller');
var q = require('q');

var sellers = extend(true, {}, persistentCollection, function () {
    return {
        collectionName: 'sellers',
        fieldDefinition: seller,
        preDelete: function (connection, id) {
            var defer = q.defer();
            // TODO: Remove references to ownership and update stamp/ownership update timestamps
            defer.resolve();
            return defer.promise;
        }
    };
}());

module.exports = sellers;
