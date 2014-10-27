var superagent = require('superagent');
var expect = require('expect.js');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

(function (describe, it, after, before) {
    "use strict";

    describe('REST Services for Catalogues', function (done) {

        var hostname, server_port, connection;

        after(function (done) {
            session.cleanup(function () {
                done();
            });
        });

        before(function (done) {
            session.initialize(function () {
                hostname = session.getHostname();
                server_port = session.getPort();
                connection = session.getConnection();
                done();
            });
        });

        it('GET Collection with 200 status', function (done) {
            NamedCollectionVerifications.verifyCollection('catalogues', done, function (obj) {
                expect(obj.issue).to.not.be(null);
                expect(obj.type).to.not.be(null);
            });
        });
        it('GET by ID with 200 status', function (done) {
            NamedCollectionVerifications.verifySingleItem('catalogues', {
                id: 1,
                name: 'Stamps of the world',
                issue: 2014,
                type: 0
            }, done, function (obj) {
                expect(obj.issue).to.be.eql(2014);
                expect(obj.type).to.be.eql(0);
            });
        });
        it('GET by invalid ID with 404 status', function (done) {
            NamedCollectionVerifications.verifyNotFound('catalogues', done);
        });

        it('PUT with invalid non-existing ID', function (done) {
            NamedCollectionVerifications.verifyPutNotFound('catalogues', { description: 'some value' }, done);
        });

        it('POST valid creation with 201 status', function (done) {
            NamedCollectionVerifications.verifyPost('catalogues', {
                name: 'Scott Postage Specialized', issue: 2012, type: 1, code: 'USD', description: 'Detailed specialized'
            }, done, function (obj) {
                expect(obj.issue).to.be.eql(2012);
                expect(obj.type).to.be.eql(1);
                expect(obj.code).to.be.eql('USD');
            });
        });

        it('DELETE successful with no retained state', function (done) {
            NamedCollectionVerifications.verifyDelete('catalogues', {
                name: 'Deleting Catalogue', issue: 2014, type: 2, currency: 'CAD'
            }, done);
        });

        it('DELETE vetoed for orphaned stamps', function (done) {
            NamedCollectionVerifications.verifyPost('catalogues', {
                name: 'Unable to delete orphans', issue: 2014, type: 1
            }, null, function (obj) {
                var id = obj.id;
                var stamp = {
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
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                    .send(stamp)
                    .end(function (e, res) {
                        expect(res.status).to.be(201);
                        superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogues/' + id)
                            .end(function (e, res) {
                                expect(res.status).to.be(409);
                                done();
                            });
                    });
            });
        });

        it('DELETE ok for secondary catalogue numbers', function (done) {
            NamedCollectionVerifications.verifyPost('catalogues', {
                name: 'ok to delete secondary CNs', issue: 2012, type: 2
            }, null, function (obj) {
                var id = obj.id;
                var stamp = {
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
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                    .send(stamp)
                    .end(function (e, res) {
                        expect(res.status).to.be(201);
                        superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogues/' + id)
                            .end(function (e, res) {
                                expect(res.status).to.be(204);
                                done();
                            });
                    });
            });
        });

        it('DELETE no existing ID', function (done) {
            NamedCollectionVerifications.verifyDeleteNotFound('catalogues', done);
        });
    });
})(describe,it,after,before);