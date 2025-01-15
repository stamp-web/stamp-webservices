const Logger = require('./logger');
const fx = require('money');
const http = require('http');
const fs = require('fs');
const nconf = require('nconf');

const logger = Logger.getLogger("server");

nconf.argv().env().file(__dirname + '/../../config/application.json');

const TIME_INTERVAL = 60 * 60 * 6 * 1000; // 6 hours

function ExchangeRates() { }

ExchangeRates.initialized = false;
ExchangeRates.initialize = callback => {
    "use strict";

    const filename = __dirname + '/../../config/exchange-rates.json';

    const configureFx = (data) => {
        if (data) {
            fx.base = data.base;
            fx.rates = data.rates;
            ExchangeRates.initialized = true;
            callback();
        }
    }


    const retrieveExchangeData = () => {
        return new Promise((resolve, reject) => {
            let exchangeData = {};
            let chunks = "";
            const appId = nconf.get("openexchangerates.org").app_id;
            if (!appId) {
                reject("No app_id found for openexchangerates.org so no new rates can be obtained.");
            } else {
                logger.info("Fetching rates from openexchangerates.org");
                http.get('http://openexchangerates.org/api/latest.json?app_id=' + appId, res => {
                    if (res.statusCode === 200) {
                        res.on('data', chunk => {
                            chunks += chunk;
                        });
                        res.on('end',  () => {
                            exchangeData = JSON.parse(chunks);
                            exchangeData.lastUpdated = new Date().getTime();
                            fs.writeFile(filename, JSON.stringify(exchangeData), () => {
                                resolve(exchangeData);
                            });
                            logger.info("Completed updating exchange rates data file.");
                        });
                    } else {
                        reject("Open Exchange responded with status code " + res.statusCode);
                    }
                });
            }
        });
    }

    fs.exists(filename, function (exists) {
        let getNew = !exists;
        let exchangeData = {};
        if (exists) {
            getNew = false;
            fs.readFile(filename, {encoding: 'UTF-8'},  (err, data) => {
                exchangeData = JSON.parse(data);
                if (!exchangeData.lastUpdated || new Date().getTime() - exchangeData.lastUpdated > TIME_INTERVAL) {
                    exchangeData = retrieveExchangeData().then(exchangeData => {
                        configureFx(exchangeData);
                    }, err => {
                        logger.error(err);
                    });
                } else {
                    configureFx(exchangeData);
                }

            });
        }
        if (getNew) {
            retrieveExchangeData().then( data => {
                configureFx(data);
            }, function(err) {
                logger.error(err);
            });

        }
    }); // end exists
};
ExchangeRates.checkRates = function (callback) {
    "use strict";
    if (!ExchangeRates.initialized) {
        ExchangeRates.initialize(callback);
    } else {
        callback();
    }
};

module.exports = ExchangeRates;