import superagent from 'superagent';
import session from './util/integration-session.js';
import NamedCollectionVerifications from './util/named-collection-verifier.js';

describe('REST Services for Catalogues', () => {

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
        await NamedCollectionVerifications.verifyCollection('catalogues', (obj) => {
            expect(obj.issue).not.toBe(null);
            expect(obj.type).not.toBe(null);
        });
    });
    
    it('GET by ID with 200 status', async () => {
        await NamedCollectionVerifications.verifySingleItem('catalogues', {
            id:    1,
            name:  'Stamps of the world',
            issue: 2014,
            type:  0
        }, (obj) => {
            expect(obj.issue).toEqual(2014);
            expect(obj.type).toEqual(0);
        });
    });
    
    it('GET by invalid ID with 404 status', async () => {
        await NamedCollectionVerifications.verifyNotFound('catalogues');
    });

    it('PUT with invalid non-existing ID', async () => {
        await NamedCollectionVerifications.verifyPutNotFound('catalogues', {description: 'some value'});
    });

    it('POST valid creation with 201 status', async () => {
        await NamedCollectionVerifications.verifyPost('catalogues', {
            name: 'Scott Postage Specialized', issue: 2012, type: 1, code: 'USD', description: 'Detailed specialized'
        }, (obj) => {
            expect(obj.issue).toEqual(2012);
            expect(obj.type).toEqual(1);
            expect(obj.code).toEqual('USD');
        });
    });

    it('DELETE successful with no retained state', async () => {
        await NamedCollectionVerifications.verifyDelete('catalogues', {
            name: 'Deleting Catalogue', issue: 2014, type: 2, currency: 'CAD'
        });
    });

    it('DELETE vetoed for orphaned stamps', async () => {
        let id;
        await NamedCollectionVerifications.verifyPost('catalogues', {
            name: 'Unable to delete orphans', issue: 2014, type: 1
        }, (obj) => {
            id = obj.id;
        });
        const stamp = {
            countryRef: 1,
            rate: "1d",
            description: "reddish-brown",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: id,
                    number: "23a",
                    value: 0.65,
                    condition: 1,
                    active: true
                }
            ]
        };
        const resPost = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(resPost.status).toBe(201);
        await expect(superagent.del(`http://${hostname}:${server_port}/rest/catalogues/${id}`))
            .rejects.toHaveProperty('status', 409);
    });

    it('DELETE ok for secondary catalogue numbers', async () => {
        let id;
        await NamedCollectionVerifications.verifyPost('catalogues', {
            name: 'ok to delete secondary CNs', issue: 2012, type: 2
        }, (obj) => {
            id = obj.id;
        });
        const stamp = {
            countryRef: 1,
            rate: "3d",
            description: "reddish-brown",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: id,
                    number: "23a",
                    value: 0.65,
                    condition: 1,
                    active: false
                },
                {
                    catalogueRef: 1,
                    number: "1-active",
                    value: 0.25,
                    active: true,
                    condition: 1
                }
            ]
        };
        const resPost = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(resPost.status).toBe(201);
        const resDel = await superagent.del(`http://${hostname}:${server_port}/rest/catalogues/${id}`);
        expect(resDel.status).toBe(204);
    });

    it('DELETE no existing ID', async () => {
        await NamedCollectionVerifications.verifyDeleteNotFound('catalogues');
    });
});
