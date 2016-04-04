var _ = require('lodash');
var q = require('q');
var Logger = require('./logger');
var fx = require('money');
var accounting = require('accounting');
var http = require('http');
var fs = require('fs');
var nconf = require('nconf');

var logger = Logger.getLogger("server");

nconf.argv().env().file(__dirname + '/../../config/application.json');

var TIME_INTERVAL = 60 * 60 * 6 * 1000; // 6 hours

function ExchangeRates() { }

ExchangeRates.initialized = false;
ExchangeRates.initialize = function (callback) {
    "use strict";

    var filename = __dirname + '/../../config/exchange-rates.json';
    
    function configureFx(data) {
        if (data) {
            if (typeof fx !== "undefined" && fx.rates) {
                fx.rates = data.rates;
                fx.base = data.base;
            } else {
                // If not, apply to fxSetup global:
                window.fxSetup = {
                    rates : data.rates,
                    base : data.base
                };
            }
            ExchangeRates.initialized = true;
            callback();
        }
    };


    function retrieveExchangeData() {
        var exchangeData = {};
        var chunks = "";
        var appId = nconf.get("openexchangerates.org").app_id;
        if (!appId) {
            logger.warn("No app_id found for openexchangerates.org so no new rates can be obtained.");
        } else {
            logger.info("Fetching rates from openexchangerates.org");
            http.get('http://openexchangerates.org/api/latest.json?app_id=' + appId, function (res) {
                if (res.statusCode === 200) {
                    res.on('data', function (chunk) {
                        chunks += chunk;
                    });
                    res.on('end', function () {
                        exchangeData = JSON.parse(chunks);
                        exchangeData.lastUpdated = new Date().getTime();
                        fs.writeFile(filename, JSON.stringify(exchangeData), function (err) {
                            configureFx(exchangeData);
                        });
                        logger.info("Completed updating exchange rates data file.");
                    });
                } else {
                    logger.error("Open Exchange responded with status code " + res.statusCode);
                }
            });
        }
        return exchangeData;
    }

    fs.exists(filename, function (exists) {
        var getNew = !exists;
        var exchangeData = {};
        if (exists) {
            getNew = false;
            var data = fs.readFile(filename, { encoding: 'UTF-8' }, function(err,data) {
                exchangeData = JSON.parse(data);
                if (!exchangeData.lastUpdated || new Date().getTime() - exchangeData.lastUpdated > TIME_INTERVAL) {
                    exchangeData = retrieveExchangeData();
                }
                configureFx(exchangeData);
            });
        }
        if (getNew) {
            exchangeData = retrieveExchangeData();
            configureFx(exchangeData);
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