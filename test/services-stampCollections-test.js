import superagent from 'superagent';
import session from './util/integration-session.js';
import NamedCollectionVerifications from './util/named-collection-verifier.js';

describe('REST Services for Stamp Collections', () => {

    let hostname, server_port;

    afterAll(async () => {
        await session.cleanup();
    });

    beforeAll(async () => {
        await session.initialize();
        hostname = session.getHostname();
        server_port = session.getPort();
    });

    it('GET Collection with 200 status', async () => {
        await NamedCollectionVerifications.verifyCollection('stampCollections');
    });

    it('GET by ID with 200 status', async () => {
        await NamedCollectionVerifications.verifySingleItem('stampCollections', {
            id:   1,
            name: 'British Commonwealth'
        });
    });

    it('GET collection with Name query with 200 status', async () => {
        const res = await superagent.get(`http://${hostname}:${server_port}/rest/stampCollections?$filter=(name eq 'British Commonwealth')`);
        expect(res.status).toEqual(200);
        expect(res.body.total).toEqual(1);
        expect(res.body.stampCollections).not.toBe(undefined);
        const collection = res.body.stampCollections[0];
        expect(collection.name).toEqual("British Commonwealth");
        expect(collection.id).toEqual(1);
    });

    it('GET by invalid ID with 404 status', async () => {
        await NamedCollectionVerifications.verifyNotFound('stampCollections');
    });


    it('POST valid creation with 201 status', async () => {
        await NamedCollectionVerifications.verifyPost('stampCollections', {
            name: 'The World Collection', description: 'Stamps of the world'
        });
    });

    it('POST duplicate creation with 409 status', async () => {
        const res1 = await superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({name: 'German States'});
        expect(res1.status).toEqual(201);
        const body = res1.body;
        delete body.id;
        await expect(superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`).send(body))
            .rejects.toHaveProperty('status', 409);
    });

    it('POST missing name field with 400 status', async () => {
        await expect(superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({description: 'some description'}))
            .rejects.toHaveProperty('status', 400);
    });

    it('PUT successfully with 200 status', async () => {
        const name = 'POST album';
        const res1 = await superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({name: name});
        expect(res1.status).toEqual(201);
        const id = res1.body.id;
        const resPut = await superagent.put(`http://${hostname}:${server_port}/rest/stampCollections/${id}`)
            .send({name: 'PUT collection', description: 'Description on update'});
        expect(resPut.status).toEqual(200);
        expect(resPut.body.name).toEqual('PUT collection');
        expect(resPut.body.description).toEqual('Description on update');
    });

    it('PUT with invalid non-existing ID', async () => {
        await NamedCollectionVerifications.verifyPutNotFound('stampCollections', {value: 'some description'});
    });

    it('PUT causing a conflict', async () => {
        const conflict_name = 'PUT with conflict (orignial)';
        const res1 = await superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({name: conflict_name});
        expect(res1.status).toEqual(201);
        const res2 = await superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({name: 'PUT causing conflict'});
        expect(res2.status).toEqual(201);
        const id = res2.body.id;
        await expect(superagent.put(`http://${hostname}:${server_port}/rest/stampCollections/${id}`)
            .send({name: conflict_name}))
            .rejects.toHaveProperty('status', 409);
    });

    it('DELETE no existing ID', async () => {
        await NamedCollectionVerifications.verifyDeleteNotFound('stampCollections');
    });

    it('DELETE successful removes albums and countries', async () => {
        const total = 10;
        const resColl = await superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({name: "DeletingStampCollection"});
        const id = resColl.body.id;
        expect(id).toBeGreaterThan(0);
        for (let count = 0; count < total; count++) {
            await superagent.post(`http://${hostname}:${server_port}/rest/albums`)
                .send({name: `Album-${count}`, stampCollectionRef: id});
        }
        const resDel = await superagent.del(`http://${hostname}:${server_port}/rest/stampCollections/${id}`);
        expect(resDel.status).toEqual(204);
        const resGet = await superagent.get(`http://${hostname}:${server_port}/rest/albums?$filter=(name eq 'Album-5')`);
        expect(resGet.body.total).toEqual(0);
    });

});
