const superagent = require('superagent');
const session = require('./util/integration-session');
const NamedCollectionVerifications = require('./util/named-collection-verifier');

describe('REST Services for Reports', () => {

    let hostname, server_port;

    afterAll(done => {
        session.cleanup(function () {
            done();
        });
    });

    beforeAll(done => {
        session.initialize(function () {
            hostname = session.getHostname();
            server_port = session.getPort();
            done();
        });
    });

    it('Catalogue Value total is calculated', done => {
        NamedCollectionVerifications.verifyPost('countries', {
            name: 'Nova Scotia', description: 'Province of Canada'
        }, undefined, (country) => {
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
            superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
                .send(stamp)
                .end((e, res) => {
                    expect(res.status).toEqual(201);
                    superagent.get(`http://${hostname}:${server_port}/rest/reports?$filter=(${encodeURI('countryRef eq ' + country.id)})&$reportType=CatalogueValue`)
                        .end((e, res) => {
                            expect(res.status).toEqual(200);
                            expect(res.body.value).toBe('105.23')
                            expect(res.body.code).toBe('USD')
                            done()
                        });
                });
        });
    });

    it('Cost Basis is calculated', done => {
        NamedCollectionVerifications.verifyPost('countries', {
            name: 'Prince Edward Island', description: 'Province of Canada'
        }, undefined, (country) => {
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
            superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
                .send(stamp)
                .end((e, res) => {
                    expect(res.status).toEqual(201);
                    superagent.get(`http://${hostname}:${server_port}/rest/reports?$filter=(${encodeURI('albumRef eq 3')})&$reportType=CostBasis`)
                        .end((e, res) => {
                            expect(res.status).toEqual(200);
                            expect(res.body.value).toBe('3.57')
                            expect(res.body.code).toBe('USD')
                            done()
                        });
                });
        });
    });

    it('Cash Value is calculated', done => {
        NamedCollectionVerifications.verifyPost('countries', {
            name: `Test-${new Date().getTime()}`
        }, undefined, (country) => {
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
            superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
                .send(stamp)
                .end((e, res) => {
                    expect(res.status).toEqual(201);
                    superagent.get(`http://${hostname}:${server_port}/rest/reports?$filter=(${encodeURI('countryRef eq ' + country.id)})&$reportType=CashValue`)
                        .end((e, res) => {
                            expect(res.status).toEqual(200);
                            expect(res.body.value).toBe('3.75')
                            expect(res.body.code).toBe('USD')
                            done()
                        });
                });
        });
    });
});
