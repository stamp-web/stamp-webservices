var anyDB = require('any-db');
var begin = require('any-db-transaction')
var logger = require('../util/logger');

module.exports = function () {
    var connectionInfo = {
        port: 3306,
        hostname: 'localhost',
        database: 'unittest',
        username: 'tester',
        password: 'tester',
        driver: 'mysql'
    };
    var transactions = {};
    var connection;
    var conn;

    function getConnectionURL() {
        return connectionInfo.driver + "://" + connectionInfo.username + ":" + connectionInfo.password + "@" +
            connectionInfo.hostname + ":" + connectionInfo.port + "/" + connectionInfo.database;
    }


    return {
        getConnection: function () {
            return anyDB.createConnection(getConnectionURL());
            /*if (!connection) {
                connection = anyDB.createPool(getConnectionURL(), { min: 2, max: 10 });
                connection.on('release', function () {
                    console.log("releasing it");
                 
                });
            }
            return connection;*/
        }
    };
}();