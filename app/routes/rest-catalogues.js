import restInterfaces from './rest-interfaces.js';
import entityManaged from './rest-entitymanaged.js';
import catalogues from "../services/catalogues.js";
import catalogue from '../model/catalogue.js';
import Authenticator from '../util/authenticator.js';
import extend from 'node.extend';

const RESOURCE_PATH = "/catalogues";

export const configure = (app, basePath) => {
    const service = extend(true, {}, new entityManaged(catalogues), new restInterfaces());
    app.get(basePath + RESOURCE_PATH + "/\\!countStamps", Authenticator.applyAuthentication(), service.countStamps);
    service.initialize(app, basePath + RESOURCE_PATH, catalogues, catalogue);
};