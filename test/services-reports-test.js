var superagent = require('superagent');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');
var _ = require('lodash');

describe('REST Services for Reports', () => {

    var hostname, server_port, connection;

    afterAll(done => {
        session.cleanup(function () {
            done();
        });
    });

    beforeAll(done => {
        session.initialize(function () {
            hostname = session.getHostname();
            server_port = session.getPort();
            connection = session.getConnection();
            done();
        });
    });

    it('Catalogue Value total is calculated', done => {
        NamedCollectionVerifications.verifyPost('countries', {
            name: 'Nova Scotia', description: 'Province of Canada'
        }, undefined, (country) => {
            var stamp = {
                countryRef:       country.id,
                rate:             "1d",
                description:      "reddish brown",
                wantList:         false,
                catalogueNumbers: [
                    {
                        catalogueRef: 2,
                        number:       "23a",
                        value:        105.23,
                        condition:    1,
                        active:       true
                    }
                ],
                stampOwnerships:  []
            };
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(res.status).toEqual(201);
                    superagent.get(`http://${hostname}:${server_port}/rest/reports?$filter=(${encodeURI('countryRef eq ' + country.id)})&$reportType=CatalogueValue`)
                        .end(function (e, res) {
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
            var stamp = {
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
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(res.status).toEqual(201);
                    superagent.get(`http://${hostname}:${server_port}/rest/reports?$filter=(${encodeURI('albumRef eq 3')})&$reportType=CostBasis`)
                        .end(function (e, res) {
                            expect(res.status).toEqual(200);
                            expect(res.body.value).toBe('3.57')
                            expect(res.body.code).toBe('USD')
                            done()
                        });
                });
        });
    });
});
