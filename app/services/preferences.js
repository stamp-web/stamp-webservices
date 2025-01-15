const extend = require('node.extend');
const PersistentCollection = require('./persistent-collection');
const preference = require('../model/preference');

const preferences = extend(true, {}, new PersistentCollection(), function () {
    return {
        collectionName: 'preferences',
        fieldDefinition: preference
    };
}());

module.exports = preferences;
