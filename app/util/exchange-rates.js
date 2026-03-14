const Logger = require('./logger');
const fx = require('money');
const https = require('https');
const fs = require('fs');
const nconf = require('nconf');

const logger = Logger.getLogger("server");

nconf.argv().env().file(__dirname + '/../../config/application.json');

const EXCHANGE_RATES_CONFIG_PATH = '/../../config/exchange-rates.json';
const EXCHANGE_RATES_TIME_INTERVAL = 86400000; // 24 hours in milliseconds
const OPENEXCHANGERATES_API_URL = 'https://openexchangerates.org/api/latest.json';


function ExchangeRates() { }

ExchangeRates.configureFx = (data) => {
    if (data && data.rates) {
        fx.base = data.base;
        fx.rates = data.rates;
        ExchangeRates.initialized = true;
    }
};

ExchangeRates.retrieveExchangeData = () => {
    return new Promise((resolve, reject) => {
        const appId = nconf.get("openexchangerates.org").app_id;
        if (!appId) {
            return reject("No app_id found for openexchangerates.org so no new rates can be obtained.");
        }
        logger.info("Fetching rates from openexchangerates.org");
        https.get(`${OPENEXCHANGERATES_API_URL}?app_id=${appId}`, res => {
            if (res.statusCode !== 200) {
                return reject(`Open Exchange responded with status code ${res.statusCode}`);
            }
            let chunks = "";
            res.on('data', chunk => {
                chunks += chunk;
            });
            res.on('end', () => {
                try {
                    const exchangeData = JSON.parse(chunks);
                    exchangeData.lastUpdated = new Date().getTime();
                    fs.writeFile(__dirname + EXCHANGE_RATES_CONFIG_PATH, JSON.stringify(exchangeData), (err) => {
                        if (err) {
                            return reject(err);
                        }
                        logger.info("Completed updating exchange rates data file.");
                        resolve(exchangeData);
                    });
                } catch (parseErr) {
                    reject(parseErr);
                }
            });
        }).on('error', reject);
    });
};

ExchangeRates.loadExchangeDataFromFile = async (filename) => {
    try {
        const data = await fs.promises.readFile(filename, { encoding: 'UTF-8' });
        const exchangeData = JSON.parse(data);
        return exchangeData;
    } catch (err) {
        return null;
    }
};

ExchangeRates.initialize = async (callback) => {
    const filename = __dirname + EXCHANGE_RATES_CONFIG_PATH;
    try {
        let exchangeData = await ExchangeRates.loadExchangeDataFromFile(filename);
        if (!exchangeData || ExchangeRates.isExchangeDataExpired(exchangeData)) {
            exchangeData = await ExchangeRates.retrieveExchangeData();
        }
        ExchangeRates.configureFx(exchangeData);
        callback();
    } catch (err) {
        logger.error(err);
        callback(err);
    }
};


ExchangeRates.checkRates = function (callback) {
    if (!ExchangeRates.initialized) {
        ExchangeRates.initialize(callback);
    } else {
        callback();
    }
};

module.exports = ExchangeRates;