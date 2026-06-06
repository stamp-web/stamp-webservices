import _ from 'lodash';
import superagent from 'superagent';
import session from './util/integration-session.js';
import NamedCollectionVerifications from './util/named-collection-verifier.js';

describe('REST Services for Albums', () => {

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
        await NamedCollectionVerifications.verifyCollection('albums', (obj) => {
            expect(obj.stampCollectionRef).toBeGreaterThan(0);
        });
    });

    it('GET by ID with 200 status', async () => {
        await NamedCollectionVerifications.verifySingleItem('albums', {
            id:   1,
            name: 'Australia'
        }, (obj) => {
            expect(obj.stampCollectionRef).toEqual(1);
        });
    });

    it('GET collection with Name query with 200 status', async () => {
        const res = await superagent.get(`http://${hostname}:${server_port}/rest/albums?$filter=(name eq 'Australian States')`);
        expect(res.status).toEqual(200);
        expect(res.body.total).toEqual(1);
        expect(res.body.albums).not.toBe(undefined);
        const album = res.body.albums[0];
        expect(album.name).toEqual("Australian States");
        expect(album.id).toEqual(2);
    });

    it('GET by invalid ID with 404 status', async () => {
        await NamedCollectionVerifications.verifyNotFound('albums');
    });

    it('POST valid creation with 201 status', async () => {
        await NamedCollectionVerifications.verifyPost('albums', {
            name: 'British Europe', stampCollectionRef: 1, description: 'European countries'
        }, (obj) => {
            expect(obj.stampCollectionRef).toEqual(1);
        });
    });

    it('POST duplicate creation with 409 status', async () => {
        const res = await superagent.post(`http://${hostname}:${server_port}/rest/albums`)
            .send({name: 'German States', stampCollectionRef: 1});
        expect(res.status).toEqual(201);
        const body = res.body;
        delete body.id;
        await expect(superagent.post(`http://${hostname}:${server_port}/rest/albums`).send(body))
            .rejects.toHaveProperty('status', 409);
    });

    it('POST missing name field with 400 status', async () => {
        await expect(superagent.post(`http://${hostname}:${server_port}/rest/albums`)
            .send({description: 'some description'}))
            .rejects.toHaveProperty('status', 400);
    });

    it('POST missing stamp collection ref field with 400 status', async () => {
        await expect(superagent.post(`http://${hostname}:${server_port}/rest/albums`)
            .send({name: 'Some album'}))
            .rejects.toHaveProperty('status', 400);
    });

    it('Move album to new collection', async () => {
        const name = 'Move Album';
        const res = await superagent.post(`http://${hostname}:${server_port}/rest/albums`)
            .send({name: name, stampCollectionRef: 1});
        expect(res.status).toEqual(201);
        const id = res.body.id;
        const resMove = await superagent.post(`http://${hostname}:${server_port}/rest/albums/${id}/moveTo/2`);
        expect(resMove.status).toBe(200);
        const body = resMove.body;
        expect(body.name).toEqual('Move Album');
        expect(body.stampCollectionRef).toEqual(2);
    });

    it('PUT successfully with 200 status', async () => {
        const name = 'POST album';
        const res = await superagent.post(`http://${hostname}:${server_port}/rest/albums`)
            .send({name: name, stampCollectionRef: 1, countries: [1]});
        expect(res.status).toEqual(201);
        const id = res.body.id;
        const resPut = await superagent.put(`http://${hostname}:${server_port}/rest/albums/${id}`)
            .send({name: 'PUT album', description: 'Description on update', countries: [2]});
        expect(resPut.status).toBe(200);
        const body = resPut.body;
        expect(body.name).toEqual('PUT album');
        expect(body.description).toEqual('Description on update');
        expect(body.countries).not.toEqual(null);
        expect(body.countries.length).toEqual(1);
        expect(body.countries[0]).toEqual(2);
    });

    it('PUT with invalid non-existing ID', async () => {
        await NamedCollectionVerifications.verifyPutNotFound('albums', {
            name: 'mystery album',
            description: 'some description',
            stampCollectionRef: 1
        });
    });

    it('PUT causing a conflict', async () => {
        const conflict_name = 'PUT with conflict (orignial)';
        const res1 = await superagent.post(`http://${hostname}:${server_port}/rest/albums`)
            .send({name: conflict_name, stampCollectionRef: 1});
        expect(res1.status).toEqual(201);
        const res2 = await superagent.post(`http://${hostname}:${server_port}/rest/albums`)
            .send({name: 'PUT causing conflict', stampCollectionRef: 1});
        expect(res2.status).toEqual(201);
        const id = res2.body.id;
        await new Promise(resolve => _.delay(resolve, 500));
        await expect(superagent.put(`http://${hostname}:${server_port}/rest/albums/${id}`)
            .send({name: conflict_name}))
            .rejects.toHaveProperty('status', 409);
    });

    it('DELETE no existing ID', async () => {
        await NamedCollectionVerifications.verifyDeleteNotFound('albums');
    });

    it('DELETE successful with cascade to ALBUMS_COUNTRIES', async () => {
        await NamedCollectionVerifications.verifyDelete('albums', {
            name: 'TEST DELETE', stampCollectionRef: 1, countries: [1]
        }, async () => {
            const res = await superagent.get(`http://${hostname}:${server_port}/rest/countries/1`);
            expect(res.status).toEqual(200);
            expect(res.body.id).toEqual(1);
        });
    });

    it('DELETE removes Ownership but retains Stamp with updated ModifyStamp', async () => {
        let albumID;
        await NamedCollectionVerifications.verifyPost('albums', {
            name: 'An Album to behold', stampCollectionRef: 1, description: 'European countries'
        }, (obj) => {
            albumID = obj.id;
        });
        const stamp = {
            countryRef: 1,
            rate: "1d",
            description: "reddish brown",
            wantList: false,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "23a",
                    value: 0.65,
                    condition: 1,
                    active: true
                }
            ],
            stampOwnerships: [
                {
                    albumRef: albumID
                }
            ]
        };
        const resPost = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(resPost.status).toEqual(201);
        const stampId = resPost.body.id;
        const resDel = await superagent.del(`http://${hostname}:${server_port}/rest/albums/${albumID}`);
        expect(resDel.status).toEqual(204);
        const resGet = await superagent.get(`http://${hostname}:${server_port}/rest/stamps/${stampId}`);
        expect(resGet.status).toEqual(200);
        expect(resGet.body.stampOwnerships.length).toBe(0);
    });
});
