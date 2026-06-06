import superagent from 'superagent';
import nconf from 'nconf';

nconf.argv().env();

let server_port = 9002;
let hostname = 'localhost';

if (nconf.get("port")) {
    server_port = +nconf.get("port");
}
if (nconf.get("hostname")) {
    hostname = nconf.get("hostname");
}

const randomId = () => {
    return Math.floor(Math.random() * 100000);
};


const NamedCollectionVerifications = {
    verifyCollection: async function (collectionName, fn) {
        const res = await superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName);
        expect(res.status).toEqual(200);
        expect(res.body.total).toBeGreaterThan(0);
        expect(res.body[collectionName]).not.toBe(undefined);
        const obj = res.body[collectionName][0];
        if (obj) {
            expect(obj.name).not.toBe(undefined);
            expect(obj.id).toBeGreaterThan(0);
            if (fn) {
                await fn(obj);
            }
        } else {
            throw Error("No data present.");
        }
    },


    verifySingleItem: async function (collectionName, props, fn) {
        const res = await superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + props.id);
        expect(res.status).toEqual(200);
        expect(res.body).not.toEqual(null);
        expect(res.body.name).toEqual(props.name);
        expect(res.body.id).toEqual(props.id);
        if (props.description) {
            expect(res.body.description).toEqual(props.description);
        }
        expect(res.body.createTimestamp).toBe(undefined);
        expect(res.body.modifyTimestamp).toBe(undefined);
        if (fn) {
            await fn(res.body);
        }
    },
    verifyNotFound: async function (collectionName) {
        try {
            await superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + randomId());
            throw new Error('Expected 404 but request succeeded');
        } catch (e) {
            expect(e.status || e.response?.status).toBe(404);
        }
    },
    verifyPutNotFound: async function (collectionName, props) {
        try {
            await superagent.put('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + randomId())
                .send(props);
            throw new Error('Expected 404 but request succeeded');
        } catch (e) {
            expect(e.status || e.response?.status).toBe(404);
        }
    },
    verifyPost: async function (collectionName, props, fn) {
        const res = await superagent.post('http://' + hostname + ':' + server_port + '/rest/' + collectionName)
            .send(props);
        expect(res.status).toEqual(201);
        const body = res.body;
        expect(body.id).not.toEqual(null);
        expect(body.id).toBeGreaterThan(1000);
        expect(body.name).toEqual(props.name);
        if (props.description) {
            expect(body.description).toEqual(props.description);
        }
        if (fn) {
            await fn(body);
        }
    },
    verifyDeleteNotFound: async function (collectionName) {
        try {
            await superagent.del('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + randomId());
            throw new Error('Expected 404 but request succeeded');
        } catch (e) {
            expect(e.status || e.response?.status).toBe(404);
        }
    },

    verifyDelete: async function (collectionName, props, fn) {
        const res = await superagent.post('http://' + hostname + ':' + server_port + '/rest/' + collectionName)
            .send(props);
        expect(res.status).toEqual(201);
        const id = res.body.id;
        const delRes = await superagent.del('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + id);
        expect(delRes.status).toEqual(204);
        try {
            await superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + id);
            throw new Error('Expected 404 but request succeeded');
        } catch (e) {
            expect(e.status || e.response?.status).toBe(404);
            if (fn) {
                await fn();
            }
        }
    }
};

export default NamedCollectionVerifications;
