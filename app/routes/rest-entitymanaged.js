const Logger = require('../util/logger');
const routeHelper = require('./route-helper');

const logger = Logger.getLogger("server");

const entityManaged = function (collect) {
    const collection = collect;
    return {
        countStamps: (req, res) => {
            collection.countStamps().then(result => {
                res.format({
                    'text/plain': function () {
                        return res.send('' + result);
                    },
                    'application/json': function () {
                        return res.send(routeHelper.convertMap(result));
                    }
                });
            }, err => {
                logger.error(err);
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR).end();
            });
        }
    }
};


module.exports = entityManaged;