var connectionMgr = require('../../pom/connection-mysql');
var catalogueNumberService = require('../../services/catalogue-numbers');
var catalogueService = require('../../services/catalogues');
var albumService = require('../../services/albums');
var catalogueNumberHelper = require('../catalogue-number-helper');
var catalogueNumber = require('../catalogue-number');
var _ = require('lodash');

var converter = function() {
    return {
        convertAll : function(limit) {
            let cnP = catalogueNumberService.find({$limit:limit,$offset:0});
            let cP = catalogueService.find({$limit:1000,$offset:0});
            Promise.all([cnP, cP]).then(values => {
                let numbers = values[0];
                let catalogues = values[1];
//console.log(numbers.rows[0].NUMBER);
                if(numbers && catalogues) {
                    _.forEach(numbers.rows, number => {
                        //console.log(number.NUMBER);
                        let val = catalogueNumberHelper.serialize(number, catalogues.rows);
                        number.NUMBERSORT = val;
                        console.log(number.ID);
                        let num = catalogueNumber.externalize(number);
                        num.numberSort = val;
                        catalogueNumberService.update(num, number.ID).catch(err => {
                            console.log(err);
                        });
                    });
                }

            }).catch(err => {
                console.log(err);
            });
        }
    }
}();
module.exports = converter;

connectionMgr.startup().then(function () {
    converter.convertAll(100000);

    process.on('exit', function () {
        connectionMgr.shutdown();
    });
    process.on('uncaughtException', function(err) {
        console.log(err.stack); // should update to use domains/clusters
    });
    // See if the server is running as a child process and if so signal completion of startup
    if (process.send) {

        process.send("SERVER_STARTED");

    }
}, function (err) {
    logger.error(err);
    process.exit(1);
});
