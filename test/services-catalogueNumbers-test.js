import _ from 'lodash';
import superagent from 'superagent';
import session from './util/integration-session.js';

describe('REST Services for Catalogue Numbers', () => {

    let hostname, server_port;

    afterAll(async () => {
        await session.cleanup();
    });

    beforeAll(async () => {
        await session.initialize();
        hostname = session.getHostname();
        server_port = session.getPort();
    });

    it('Make active changes successfully', async () => {
        const stamp = {
            countryRef: 1,
            rate: "1d",
            description: "red",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "23a",
                    value: 0.65,
                    condition: 1,
                    active: true
                },
                {
                    catalogueRef: 2,
                    number: "14",
                    value: 1.25,
                    condition: 0,
                    active: false
                }
            ]
        };
        const res = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(res.status).toEqual(201);
        let catalogueNumbers = res.body.catalogueNumbers;
        const activate = _.find(catalogueNumbers, {active: false});
        expect(activate).not.toBe(undefined);
        const resActive = await superagent.post(`http://${hostname}:${server_port}/rest/catalogueNumbers/${activate.id}/makeActive`);
        catalogueNumbers = resActive.body.catalogueNumbers;
        expect(_.find(catalogueNumbers, {active: true}).id).toEqual(activate.id);
        expect(_.filter(catalogueNumbers, {active: true}).length).toBe(1);
    });

    it('Make active already active', async () => {
        const stamp = {
            countryRef: 1,
            rate: "1d",
            description: "red",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "23a",
                    value: 0.65,
                    condition: 1,
                    active: true
                }
            ]
        };
        const res = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(res.status).toEqual(201);
        let catalogueNumbers = res.body.catalogueNumbers;
        const activate = _.find(catalogueNumbers, {active: true});
        expect(activate).not.toBe(undefined);
        const resActive = await superagent.post(`http://${hostname}:${server_port}/rest/catalogueNumbers/${activate.id}/makeActive`);
        expect(resActive.statusCode).toBe(200);
        catalogueNumbers = resActive.body.catalogueNumbers;
        expect(_.find(catalogueNumbers, {active: true}).id).toEqual(activate.id);
        expect(_.filter(catalogueNumbers, {active: true}).length).toBe(1);
    });

    it('DELETE no existing ID', async () => {
        await expect(superagent.del(`http://${hostname}:${server_port}/rest/catalogueNumbers/800020`))
            .rejects.toHaveProperty('status', 404);
    });

    it('DELETE catalogue number directly', async () => {
        const stamp = {
            countryRef: 1,
            rate: "1d",
            description: "red-orange",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "23a",
                    value: 0.65,
                    condition: 1,
                    active: true
                },
                {
                    catalogueRef: 2,
                    number: "14",
                    value: 1.25,
                    condition: 0,
                    active: false
                }
            ]
        };
        const res = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(res.status).toEqual(201);
        const catalogueNumbers = res.body.catalogueNumbers;
        const nonActive = _.find(catalogueNumbers, {active: false});
        const stampId = res.body.id;
        expect(nonActive).not.toBe(undefined);
        const resDel = await superagent.del(`http://${hostname}:${server_port}/rest/catalogueNumbers/${nonActive.id}`);
        expect(resDel.statusCode).toBe(204);
        const resGet = await superagent.get(`http://${hostname}:${server_port}/rest/stamps/${stampId}`);
        expect(resGet.body.catalogueNumbers.length).toBe(1);
    });
});
