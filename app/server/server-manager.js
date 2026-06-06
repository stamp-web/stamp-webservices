import cluster from 'cluster';
import path from 'path';
import nconf from 'nconf';
import os from 'os';
import { fileURLToPath } from 'url';
import RestartTracker from './restart-tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

nconf.argv().env().file(path.join(__dirname, '/../../config/application.json'));

let numCPUs = os.cpus().length;
let numForks = numCPUs;
if (nconf.get("cpu") && nconf.get("cpu") > 0) {
    numForks = nconf.get("cpu");
}

const maxRestarts = nconf.get("maxRestarts") !== undefined ? +nconf.get("maxRestarts") : 10;
const restartWindow = nconf.get("restartWindow") !== undefined ? +nconf.get("restartWindow") : 60; // in seconds

const tracker = new RestartTracker(maxRestarts, restartWindow);

cluster.setupPrimary({
    exec: path.join(__dirname, 'server.js')
});

for(let i = 0; i < numForks; i++ ) {
    cluster.fork();
}

function handleRestart(worker, reason) {
    if (tracker.recordRestart()) {
        console.error('[%s] More than %d unexpected worker failures occurred in %d seconds. Killing the overall process to prevent infinite restart loop.',
            new Date(), maxRestarts, restartWindow);
        process.exit(1);
    }
    
    let w = cluster.fork();
    console.error('[%s] Worker with process ID %s %s... starting a new worker with process ID %s',
        new Date(), worker.process.pid, reason, w.process.pid);
}

cluster.on('disconnect', function (worker) {
    if (!worker.exitedAfterDisconnect && !worker.hasBeenReplaced) {
        worker.hasBeenReplaced = true;
        handleRestart(worker, 'disconnected');
    }
});

cluster.on('exit', function (worker) {
    if (!worker.exitedAfterDisconnect) {
        if (!worker.hasBeenReplaced) {
            worker.hasBeenReplaced = true;
            handleRestart(worker, 'exited unexpectedly');
        }
    } else {
        console.error('[%s] Worker with process ID %s exited',
            new Date(), worker.process.pid);
    }
});

process.on('SIGTERM', () => {
    for (const id in cluster.workers) {
        cluster.workers[id].kill();
    }
    console.log('Shutting down server...');
    process.exit(0);
});