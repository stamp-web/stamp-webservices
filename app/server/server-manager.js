import cluster from 'cluster';
import path from 'path';
import nconf from 'nconf';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

nconf.argv().env();

let numCPUs = os.cpus().length;
let numForks = numCPUs;
if (nconf.get("cpu") && nconf.get("cpu") > 0) {
    numForks = nconf.get("cpu");
}

cluster.setupPrimary({
    exec: path.join(__dirname, 'server.js')
});

for(let i = 0; i < numForks; i++ ) {
    cluster.fork();
}

cluster.on('disconnect', function (worker) {
    if (!worker.exitedAfterDisconnect) {
        let w = cluster.fork();
        console.error('[%s] Worker with process ID %s disconnected... starting a new worker with process ID %s',
            new Date(), worker.process.pid, w.process.pid);
    }
});

cluster.on('exit', function (worker) {
    if (!worker.exitedAfterDisconnect) {
        let w = cluster.fork();
        console.error('[%s] Worker with process ID %s exited unexpectedly... starting a new worker with process ID %s',
            new Date(), worker.process.pid, w.process.pid);
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