var _ = require('lodash');
var superagent = require('superagent');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');


describe('REST Services for Catalogue Numbers', () => {

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

    it('Make active changes successfully', done => {
        var stamp = {
            countryRef:       1,
            rate:             "1d",
            description:      "red",
            wantList:         true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "23a",
                    value:        0.65,
                    condition:    1,
                    active:       true
                },
                {
                    catalogueRef: 2,
                    number:       "14",
                    value:        1.25,
                    condition:    0,
                    active:       false
                }
            ]
        };
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
            .send(stamp)
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var catalogueNumbers = res.body.catalogueNumbers;
                var activate = _.find(catalogueNumbers, {active: false});
                expect(activate).not.toBe(undefined);
                superagent.post('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + activate.id + '/makeActive')
                    .end(function (e, res) {
                        catalogueNumbers = res.body.catalogueNumbers;
                        expect(_.find(catalogueNumbers, {active: true}).id).toEqual(activate.id);
                        expect(_.filter(catalogueNumbers, {active: true}).length).toBe(1);
                        done();
                    });


            });
    });

    it('Make active already active', done => {
        var stamp = {
            countryRef:       1,
            rate:             "1d",
            description:      "red",
            wantList:         true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "23a",
                    value:        0.65,
                    condition:    1,
                    active:       true
                }
            ]
        };
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
            .send(stamp)
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var catalogueNumbers = res.body.catalogueNumbers;
                var activate = _.find(catalogueNumbers, {active: true});
                expect(activate).not.toBe(undefined);
                superagent.post('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + activate.id + '/makeActive')
                    .end(function (e, res) {
                        expect(res.statusCode).toBe(200);
                        catalogueNumbers = res.body.catalogueNumbers;
                        expect(_.find(catalogueNumbers, {active: true}).id).toEqual(activate.id);
                        expect(_.filter(catalogueNumbers, {active: true}).length).toBe(1);
                        done();
                    });


            });
    });

    it('DELETE no existing ID', done => {
        superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + 800020)
            .end(function (e, res) {
                expect(res.statusCode).toBe(404);
                done();
            });
    });
    it('DELETE catalogue number directly', done => {
        var stamp = {
            countryRef:       1,
            rate:             "1d",
            description:      "red-orange",
            wantList:         true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "23a",
                    value:        0.65,
                    condition:    1,
                    active:       true
                },
                {
                    catalogueRef: 2,
                    number:       "14",
                    value:        1.25,
                    condition:    0,
                    active:       false
                }
            ]
        };
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
            .send(stamp)
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var catalogueNumbers = res.body.catalogueNumbers;
                var nonActive = _.find(catalogueNumbers, {active: false});
                var stampId = res.body.id;
                expect(nonActive).not.toBe(undefined);
                superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + nonActive.id)
                    .end(function (e, res) {
                        expect(res.statusCode).toBe(204);
                        superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps/' + stampId)
                            .end(function (e, res) {
                                expect(res.body.catalogueNumbers.length).toBe(1);
                            });
                        done();
                    });
            });
    });
});
