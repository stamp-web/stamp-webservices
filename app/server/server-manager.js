const cluster = require('cluster');
const path = require('path');
const nconf = require('nconf');
nconf.argv().env();

let numCPUs = require('os').cpus().length;
let numForks = numCPUs;
if (nconf.get("cpu")) {
    numForks = nconf.get("cpu");
}

cluster.setupMaster({
    exec: path.join(__dirname, 'server.js')
});


for(let i = 0; i < numForks; i++ ) {
    cluster.fork();
}

cluster.on('disconnect', function (worker) {
    let w = cluster.fork();
    console.error('[%s] Worker with process ID %s disconnected... starting a new worker with process ID %s',
        new Date(), worker.process.pid, w.process.pid);
});

cluster.on('exit', function (worker) {
    console.error('[%s] Worker with process ID %s exited',
        new Date(), worker.process.pid);
});

