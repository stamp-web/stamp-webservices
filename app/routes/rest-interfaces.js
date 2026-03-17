import _ from 'lodash';
import odata from 'odata-filter-parser';
import Logger from '../util/logger.js';
import Level from '../util/level.js';
import Authenticator from '../util/authenticator.js';
import routeHelper from './route-helper.js';

const Parser = odata.Parser;

const logger = Logger.getLogger("server");

function restInterfaces() {
    let collection;
    let field;

    return {
        initialize: function (app, basePath, col, f) {
            collection = col;
            field = f;

            app.get(basePath, Authenticator.applyAuthentication(), this.find);
            app.post(basePath, Authenticator.applyAuthentication(), this.create);
            app.put(`${basePath}/:id`, Authenticator.applyAuthentication(), this.update);
            app.get(`${basePath}/\\!count`, Authenticator.applyAuthentication(), this.count);
            app.get(`${basePath}/:id`, Authenticator.applyAuthentication(), this.findById);
            app.delete(`${basePath}/:id`, Authenticator.applyAuthentication(), this.remove);
            logger.debug(`   Registering services at ${basePath}`);
        },
        findById: (req, res) => {
            const id = req.params.id;
            collection.findById(id).then(async row => {
                if (row !== null) {
                    const data = await field.externalize(row);
                    res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                    res.status(routeHelper.StatusCode.OK);
                    return res.json(data);
                } else {
                    res.status(routeHelper.StatusCode.NOT_FOUND).end();
                }
            }, () => {
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR);
            });
        },
        update: (req, res) => {
            const id = req.params.id;
            collection.update(req.body, id, req.query).then(async obj => {
                let data = await field.externalize(obj);
                if (logger.isEnabled(Level.DEBUG)) {
                    logger.debug(data);
                }
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.OK);
                return res.json(data);
            }, err => {
                logger.error(err);
                routeHelper.setErrorStatus(res, err);
            });
        },
        create: (req, res) => {
            collection.create(req.body).then(async obj => {
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.CREATED);
                const data = await field.externalize(obj);
                if (logger.isEnabled(Level.DEBUG)) {
                    logger.debug(data);
                }
                return res.json(data);
            }, err => {
                logger.error(err);
                routeHelper.setErrorStatus(res, err);
            });
        },
        count: (req, res) => {
            const params = {
                $filter: (req.query && req.query.$filter) ? Parser.parse(req.query.$filter) : null,
                $limit: req.query.$top,
                $offset: req.query.$skip,
                $orderby: req.query.$orderby
            };
            collection.count(params).then(result => {
                res.format({
                    'text/plain': function () {
                        return res.send('' + result);
                    },
                    'application/json': function () {
                        return res.json({ count: result });
                    }
                });
            }, err => {
                logger.error(err);
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR).end();
            });
        },
        find: (req, res) => {
            const params = {
                $filter: (req.query && req.query.$filter) ? Parser.parse(req.query.$filter) : null,
                $limit: req.query.$top || 1000,
                $offset: req.query.$skip || 0,
                $orderby: req.query.$orderby || null
            };
            collection.find(params).then(async data => {
                const result = {
                    total: data.total
                };
                result[collection.collectionName] = [];
                for (const row of data.rows) {
                    const externalizedRow = await field.externalize(row);
                    result[collection.collectionName].push(externalizedRow);
                };
                res.set(routeHelper.Headers.CONTENT_TYPE, routeHelper.ContentType.JSON);
                res.status(routeHelper.StatusCode.OK);
                return res.json(result);
            }, err => {
                logger.error(err);
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR).end();
            });
        },
        remove: (req, res) => {
            const id = req.params.id;
            collection.remove(id).then(() => {
                res.status(routeHelper.StatusCode.NO_CONTENT).end();
            }, err => {
                routeHelper.setErrorStatus(res, err);
            });
        }
    };
}

export default restInterfaces;