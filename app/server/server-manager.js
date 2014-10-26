"use strict";

var cluster = require('cluster');
var path = require('path');
var nconf = require('nconf');
nconf.argv().env();

var numCPUs = require('os').cpus().length;
var numForks = numCPUs;
if (nconf.get("cpu")) {
    numForks = nconf.get("cpu");
}

cluster.setupMaster({
    exec: path.join(__dirname, 'server.js')
});

var created = 0;

for(var i = 0; i < 1; i++ ) {
    cluster.fork();
}

cluster.on('disconnect', function (worker) {
    var w = cluster.fork();
    console.error('[%s] Worker with process ID %s disconnected... starting a new worker with process ID %s',
        new Date(), worker.process.pid, w.process.pid);
});

cluster.on('exit', function (worker) {
    console.error('[%s] Worker with process ID %s exited',
        new Date(), worker.process.pid);
});

