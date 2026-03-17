import restInterfaces from './rest-interfaces.js';
import entityManaged from './rest-entitymanaged.js';
import countries from "../services/countries.js";
import country from '../model/country.js';
import extend from 'node.extend';
import Authenticator from '../util/authenticator.js';

const RESOURCE_PATH = "/countries";

export const configure = (app, basePath) => {
    const countriesRest = extend(true, {}, new entityManaged(countries), new restInterfaces());
    app.get(`${basePath}${RESOURCE_PATH}/\\!countStamps`, Authenticator.applyAuthentication(), countriesRest.countStamps);
    countriesRest.initialize(app, basePath + RESOURCE_PATH, countries, country);
};