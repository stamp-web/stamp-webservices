var connectionMgr = require('../../pom/connection-mysql');
var catalogueNumberService = require('../../services/catalogue-numbers');
var catalogueService = require('../../services/catalogues');
var albumService = require('../../services/albums');
var catalogueNumberHelper = require('../catalogue-number-helper');
var catalogueNumber = require('../catalogue-number');
var _ = require('lodash');

var converter = function() {
    return {
        convertAll : limit => {

           return new Promise((resolve,reject) => {
                let cnP = catalogueNumberService.find({$limit:limit,$offset:0});
                let cP = catalogueService.find({$limit:1000,$offset:0});

                Promise.all([cnP, cP]).then(values => {
                    let numbers = values[0];
                    let catalogues = values[1];
                    if (numbers && catalogues) {
                        let updates = [];
                        _.forEach(numbers.rows, number => {
                            let val = catalogueNumberHelper.serialize(number, catalogues.rows);
                            number.NUMBERSORT = val;
                            let num = catalogueNumber.externalize(number);
                            num.numberSort = val;
                            updates.push(num);
                        });
                        catalogueNumberService.bulkUpdate(updates).then(result => {
                            resolve(result);
                        }).catch(ex => {
                            console.log(ex);
                            reject(ex);
                        });
                    } else {
                        reject('Nothing to do');
                    }
                }).catch(err => {
                    console.log(err);
                    reject(err);
                });
            });
        }
    }
}();
module.exports = converter;

connectionMgr.startup().then(() => {
    converter.convertAll(100000).then(() => {
        console.log('exiting...');
        process.exit(0);
    }).catch(err => {
        throw err;
    });

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
}, (err) => {
    logger.error(err);
    process.exit(1);
});
