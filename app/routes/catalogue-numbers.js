import restInterfacesFactory from './rest-interfaces.js';
import catalogueNumbers from "../services/catalogue-numbers.js";
import catalogueNumber from '../model/catalogue-number.js';
import stamp from '../model/stamp.js';
import extend from 'node.extend';
import Authenticator from '../util/authenticator.js';
import routeHelper from './route-helper.js';

const restInterfaces = restInterfacesFactory();
const RESOURCE_PATH = "/catalogueNumbers";

export const configure = (app, basePath) => {
    const service = extend(true, {}, restInterfaces);

    service.makeActive = (req, res) => {
        catalogueNumbers.makeActive(req.params.id).then(async row => {
            if (row !== null) {
                const data = await stamp.externalize(row);
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.OK);
                return res.json(data);
            } else {
                res.status(routeHelper.StatusCode.NOT_FOUND).end();
            }
        }, () => {
            res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR);
        });
    };
    app.post(basePath + RESOURCE_PATH + "/:id/makeActive", Authenticator.applyAuthentication(), service.makeActive);
    service.initialize(app, basePath + RESOURCE_PATH, catalogueNumbers, catalogueNumber);
};