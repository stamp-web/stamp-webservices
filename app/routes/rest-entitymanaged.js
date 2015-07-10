var Logger = require('../util/logger');
var Authenticator = require('../util/authenticator');
var routeHelper = require('./route-helper');

var logger = Logger.getLogger("server");

var entityManaged = function (collect) {
    var collection = collect;
    return {
        countStamps: function (req, res) {
            collection.countStamps().then(function (result) {
                res.format({
                    'text/plain': function () {
                        res.send('' + result);
                    },
                    'application/json': function () {
                        res.send(routeHelper.convertMap(result));
                    }
                });
            }, function (err) {
                logger.error(err);
                res.status(routeHelper.StatusCode.INTERNAL_ERROR).send(routeHelper.ClientMessages.INTERNAL_ERROR).end();
            });
        }
    }
}


module.exports = entityManaged;