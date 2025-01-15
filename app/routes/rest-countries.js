const restInterfaces = require('./rest-interfaces')();
const entityManaged = require('./rest-entitymanaged');
const countries = require("../services/countries");
const country = require('../model/country');
const extend = require('node.extend');
const Authenticator = require('../util/authenticator');

const RESOURCE_PATH = "/countries";

exports.configure = (app, basePath) => {
    const countriesRest = extend(true, {}, new entityManaged(countries), restInterfaces);
    app.get(`${basePath}${RESOURCE_PATH}/\\!countStamps`, Authenticator.applyAuthentication(), countriesRest.countStamps);
    countriesRest.initialize(app, basePath + RESOURCE_PATH, countries, country);
};