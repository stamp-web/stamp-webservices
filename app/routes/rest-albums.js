const restInterfaces = require('./rest-interfaces')();
const entityManaged = require('./rest-entitymanaged');
const albums = require("../services/albums");
const album = require('../model/album');
const extend = require('node.extend');
const Logger = require('../util/logger');
const Authenticator = require('../util/authenticator');
const routeHelper = require('./route-helper');

const logger = Logger.getLogger("server");

const RESOURCE_PATH = "/albums";

exports.configure = (app, basePath) => {

    const service = extend(true, {}, new entityManaged(albums), restInterfaces);

    service.moveTo = (req, res) => {
        const scId = req.params.scId;
        const params = {
            stampCollectionRef: scId
        };
        albums.update(params, req.params.id).then(obj => {
            res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
            res.status(routeHelper.StatusCode.OK);
            const data = album.externalize(obj);
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
