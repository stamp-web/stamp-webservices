import superagent from 'superagent';
import session from './util/integration-session.js';
import NamedCollectionVerifications from './util/named-collection-verifier.js';

describe('REST Services for Reports', () => {

    let hostname, server_port;

    afterAll(async () => {
        await session.cleanup();
    });

    beforeAll(async () => {
        await session.initialize();
        hostname = session.getHostname();
        server_port = session.getPort();
    });

    it('Catalogue Value total is calculated', async () => {
        let country;
        await NamedCollectionVerifications.verifyPost('countries', {
            name: 'Nova Scotia', description: 'Province of Canada'
        }, (c) => {
            country = c;
        });
        const stamp = {
            countryRef: country.id,
            rate: "1d",
            description: "reddish brown",
            wantList: false,
            catalogueNumbers: [
                {
                    catalogueRef: 2,
                    number: "23a",
                    value: 105.23,
                    condition: 1,
                    active: true
                }
            ],
            stampOwnerships: []
        };
        const resPost = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(resPost.status).toEqual(201);
        const resReport = await superagent.get(`http://${hostname}:${server_port}/rest/reports?$filter=(${encodeURI('countryRef eq ' + country.id)})&$reportType=CatalogueValue`);
        expect(resReport.status).toEqual(200);
        expect(resReport.body.value).toBe('105.23');
        expect(resReport.body.code).toBe('USD');
    });

    it('Cost Basis is calculated', async () => {
        let country;
        await NamedCollectionVerifications.verifyPost('countries', {
            name: 'Prince Edward Island', description: 'Province of Canada'
        }, (c) => {
            country = c;
        });
        const stamp = {
            countryRef: country.id,
            rate: "1d",
            description: "purple",
            wantList: false,
            catalogueNumbers: [
                {
                    catalogueRef: 2,
                    number: "2",
                    value: 12.5,
                    condition: 1,
                    active: true
                }
            ],
            stampOwnerships: [{
                albumRef: 3,
                pricePaid: 3.57
            }]
        };
        const resPost = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(resPost.status).toEqual(201);
        const resReport = await superagent.get(`http://${hostname}:${server_port}/rest/reports?$filter=(${encodeURI('albumRef eq 3')})&$reportType=CostBasis`);
        expect(resReport.status).toEqual(200);
        expect(resReport.body.value).toBe('3.57');
        expect(resReport.body.code).toBe('USD');
    });

    it('Cash Value is calculated', async () => {
        let country;
        await NamedCollectionVerifications.verifyPost('countries', {
            name: `Test-${new Date().getTime()}`
        }, (c) => {
            country = c;
        });
        const stamp = {
            countryRef: country.id,
            rate: "1d",
            description: "red",
            wantList: false,
            catalogueNumbers: [
                {
                    catalogueRef: 2,
                    number: "23a",
                    value: 100.0,
                    condition: 1,
                    active: true
                }
            ],
            stampOwnerships: [{
                albumRef: 3,
                grade: 2,
                defects: 128,
                pricePaid: 22.50
            }]
        };
        const resPost = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(resPost.status).toEqual(201);
        const resReport = await superagent.get(`http://${hostname}:${server_port}/rest/reports?$filter=(${encodeURI('countryRef eq ' + country.id)})&$reportType=CashValue`);
        expect(resReport.status).toEqual(200);
        expect(resReport.body.value).toBe('3.75');
        expect(resReport.body.code).toBe('USD');
    });
});
