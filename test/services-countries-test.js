import _ from 'lodash';
import superagent from 'superagent';
import session from './util/integration-session.js';
import stampUtil from './util/stamp-utilities.js';
import NamedCollectionVerifications from './util/named-collection-verifier.js';

describe('REST Services for Countries', () => {

    let hostname, server_port, connection;

    afterAll(async () => {
        await session.cleanup();
    });

    beforeAll(async () => {
        await session.initialize();
        hostname = session.getHostname();
        server_port = session.getPort();
        connection = session.getConnection();
    });

    it('countStamps will execute with no stamps in system', async () => {
        const res = await superagent.get(`http://${hostname}:${server_port}/rest/countries/!countStamps`);
        expect(res.status).toEqual(200);
        const result = res.body;
        expect(_.isEmpty(result)).toBe(true);
    });

    it('GET Collection with 200 status', async () => {
        await NamedCollectionVerifications.verifyCollection("countries");
    });

    it('GET by ID with 200 status', async () => {
        await NamedCollectionVerifications.verifySingleItem('countries', {
            id:   2,
            name: 'Canada'
        });
    });

    it('GET collection with Name query with 200 status', async () => {
        const res = await superagent.get(`http://${hostname}:${server_port}/rest/countries?$filter=(name eq 'Canada')`);
        expect(res.status).toEqual(200);
        expect(res.body.total).toEqual(1);
        expect(res.body.countries).not.toBe(undefined);
        const country = res.body.countries[0];
        expect(country.name).toEqual("Canada");
        expect(country.id).toEqual(2);
    });

    it('GET by invalid ID with 404 status', async () => {
        await NamedCollectionVerifications.verifyNotFound('countries');
    });

    it('POST valid creation with 201 status', async () => {
        await NamedCollectionVerifications.verifyPost('countries', {
            name: 'German States - Bavaria', description: 'State of Germany'
        });
    });

    it('POST duplicate creation with 409 status', async () => {
        const res1 = await superagent.post(`http://${hostname}:${server_port}/rest/countries`)
            .send({name: 'German States - Prussia'});
        expect(res1.status).toEqual(201);
        const body = res1.body;
        delete body.id;
        await expect(superagent.post(`http://${hostname}:${server_port}/rest/countries`).send(body))
            .rejects.toHaveProperty('status', 409);
    });

    it('POST missing name field with 400 status', async () => {
        await expect(superagent.post(`http://${hostname}:${server_port}/rest/countries`)
            .send({description: 'some description'}))
            .rejects.toHaveProperty('status', 400);
    });

    it('PUT successfully with 200 status', async () => {
        const name = 'POST success';
        const res1 = await superagent.post(`http://${hostname}:${server_port}/rest/countries`)
            .send({name: name});
        expect(res1.status).toEqual(201);
        const id = res1.body.id;
        const resPut = await superagent.put(`http://${hostname}:${server_port}/rest/countries/${id}`)
            .send({name: 'PUT update', description: 'Description on update'});
        expect(resPut.status).toEqual(200);
        expect(resPut.body.name).toEqual('PUT update');
        expect(resPut.body.description).toEqual('Description on update');
    });

    it('PUT successfully changing image paths on stamps', async () => {
        const name = `Country Test${(new Date()).getTime()}`;
        const res1 = await superagent.post(`http://${hostname}:${server_port}/rest/countries`)
            .send({name: name});
        expect(res1.status).toEqual(201);
        const id = res1.body.id;
        const stamp = {
            id: (new Date()).getTime() % 1024,
            countryRef: id,
            stampOwnerships: [{
                albumRef: 2,
                condition: 2,
                grade: 1,
                img: name + '/55.jpg'
            }]
        };
        await stampUtil.create(stamp);
        const resPut = await superagent.put(`http://${hostname}:${server_port}/rest/countries/${id}?modifyImagePath=true`)
            .send({name: 'Another Country Name'});
        expect(resPut.status).toEqual(200);
        expect(resPut.body.name).toEqual('Another Country Name');
        const resGet = await superagent.get(`http://${hostname}:${server_port}/rest/stamps?$filter=(countryRef eq ${id})`);
        expect(resGet.body.total).toBeGreaterThan(0);
        const stampResult = resGet.body.stamps[0];
        const ownership = stampResult.stampOwnerships[0];
        expect(ownership.img).toEqual('Another Country Name/55.jpg');
    });

    it('PUT with invalid non-existing ID', async () => {
        await NamedCollectionVerifications.verifyPutNotFound('countries', {description: 'some description'});
    });

    it('PUT causing a conflict', async () => {
        const conflict_name = 'PUT with conflict (orignial)';
        const res1 = await superagent.post(`http://${hostname}:${server_port}/rest/countries`)
            .send({name: conflict_name});
        expect(res1.status).toBe(201);
        const res2 = await superagent.post(`http://${hostname}:${server_port}/rest/countries`)
            .send({name: 'PUT causing conflict'});
        expect(res2.status).toBe(201);
        let id = res2.body.id;
        await expect(superagent.put(`http://${hostname}:${server_port}/rest/countries/${id}`)
            .send({name: conflict_name}))
            .rejects.toHaveProperty('status', 409);
    });

    it('DELETE no existing ID', async () => {
        await NamedCollectionVerifications.verifyDeleteNotFound('countries');
    });

    it('DELETE successful with no retained state', async () => {
        await NamedCollectionVerifications.verifyDelete('countries', {name: 'Test Delete'});
    });

    it('DELETE cascade to ALBUMS_COUNTRIES', async () => {
        let countryId, albumId;
        await NamedCollectionVerifications.verifyPost('countries', {
            name: 'Test of Country Delete Cascade'
        }, (country) => {
            countryId = country.id;
        });
        await NamedCollectionVerifications.verifyPost('albums', {
            name: 'Test of Country Delete Cascade', countries: [countryId], stampCollectionRef: 1
        }, (album) => {
            albumId = album.id;
        });
        const resDel = await superagent.del(`http://${hostname}:${server_port}/rest/countries/${countryId}`);
        expect(resDel.status).toBe(204);
        const resGet = await superagent.get(`http://${hostname}:${server_port}/rest/albums/${albumId}`);
        expect(resGet.status).toBe(200);
        expect(resGet.body.countries.length).toBe(0);
    });

    it('DELETE successfully removes associated stamp(s).', async () => {
        let countryId;
        await NamedCollectionVerifications.verifyPost('countries', {
            name: 'Test of Delete Country_ID'
        }, (country) => {
            countryId = country.id;
        });
        
        await new Promise((resolve, reject) => {
            connection.query('INSERT INTO STAMPS (ID,COUNTRY_ID,DENOMINATION) VALUES(80201,' + countryId + ',"1d")', (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
        
        const resDel = await superagent.del(`http://${hostname}:${server_port}/rest/countries/${countryId}`);
        expect(resDel.status).toBe(204);
        
        const data = await new Promise((resolve, reject) => {
            connection.query('SELECT COUNT(DISTINCT ID) AS count FROM STAMPS WHERE COUNTRY_ID=' + countryId, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        expect(data[0].count).toBe(0);
    });
});
