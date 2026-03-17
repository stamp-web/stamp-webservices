import stampCollections from "../services/stamp-collections.js";
import entityManaged from './rest-entitymanaged.js';
import stampCollection from '../model/stamp-collection.js';
import restInterfaces from './rest-interfaces.js';
import Authenticator from '../util/authenticator.js';
import extend from 'node.extend';

const RESOURCE_PATH = "/stampCollections";

export const configure = (app, basePath) => {

    const scRest = extend(true, {}, new entityManaged(stampCollections), new restInterfaces());
    app.get(basePath + RESOURCE_PATH + "/\\!countStamps", Authenticator.applyAuthentication(), scRest.countStamps);
    scRest.initialize(app, basePath + RESOURCE_PATH, stampCollections, stampCollection);
};