const preferences = require("../services/preferences");
const preference = require('../model/preference');
const restInterfaces = require('./rest-interfaces')();
const extend = require('node.extend');

const RESOURCE_PATH = "/preferences";

exports.configure = (app, basePath) => {
    const prefsRest = extend(true, {}, restInterfaces);
    prefsRest.initialize(app, `${basePath}${RESOURCE_PATH}`, preferences, preference);
};