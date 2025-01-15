const restInterfaces = require('./rest-interfaces')();
const catalogueNumbers = require("../services/catalogue-numbers");
const catalogueNumber = require('../model/catalogue-number');
const stamp = require('../model/stamp');
const extend = require('node.extend');
const Authenticator = require('../util/authenticator');
const routeHelper = require('./route-helper');

const RESOURCE_PATH = "/catalogueNumbers";

exports.configure = (app, basePath) => {
    const service = extend(true, {}, restInterfaces);

    service.makeActive = (req,res) => {
        catalogueNumbers.makeActive(req.params.id).then(row => {
            if (row !== null) {
                const data = stamp.externalize(row);
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
    app.post(basePath + RESOURCE_PATH + "/:id/makeActive", Authenticator.applyAuthentication(), service.makeActive );
    service.initialize(app, basePath + RESOURCE_PATH, catalogueNumbers, catalogueNumber);
};
