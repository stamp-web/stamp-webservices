import restInterfaces from './rest-interfaces.js';
import entityManaged from './rest-entitymanaged.js';
import albums from "../services/albums.js";
import album from '../model/album.js';
import extend from 'node.extend';
import Logger from '../util/logger.js';
import Authenticator from '../util/authenticator.js';
import routeHelper from './route-helper.js';

const logger = Logger.getLogger("server");

const RESOURCE_PATH = "/albums";

export const configure = (app, basePath) => {

    const service = extend(true, {}, new entityManaged(albums), new restInterfaces());

    service.moveTo = (req, res) => {
        const scId = req.params.scId;
        const params = {
            stampCollectionRef: scId
        };
        albums.update(params, req.params.id).then(async obj => {
            res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
            res.status(routeHelper.StatusCode.OK);
            const data = await album.externalize(obj);
            return res.json(data);
        }, err => {
            logger.error(err);
            routeHelper.setErrorStatus(res, err);
        });

    };
    app.post(basePath + RESOURCE_PATH + "/:id/moveTo/:scId", Authenticator.applyAuthentication(), service.moveTo );
    app.get(basePath + RESOURCE_PATH + "/\\!countStamps", Authenticator.applyAuthentication(), service.countStamps);
    service.initialize(app, basePath + RESOURCE_PATH, albums, album);
};