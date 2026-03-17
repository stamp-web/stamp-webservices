import restInterfaces from './rest-interfaces.js';
import entityManaged from './rest-entitymanaged.js';
import Authenticator from '../util/authenticator.js';
import sellers from "../services/sellers.js";
import seller from '../model/seller.js';
import extend from 'node.extend';

const RESOURCE_PATH = "/sellers";

export const configure = (app, basePath) => {
    const sellersRest = extend(true, {}, new entityManaged(sellers), new restInterfaces());
    app.get(basePath + RESOURCE_PATH + "/\\!countStamps", Authenticator.applyAuthentication(), sellersRest.countStamps);
    sellersRest.initialize(app, basePath + RESOURCE_PATH, sellers, seller);
};