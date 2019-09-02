var _ = require('lodash');
var superagent = require('superagent');
var expect = require('expect.js');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

(function (describe, it, after, before) {
    "use strict";

    describe('REST Services for Catalogue Numbers', function () {

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

        it('Make active changes successfully', function (done) {
            var stamp = {
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
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var catalogueNumbers = res.body.catalogueNumbers;
                    var activate = _.find(catalogueNumbers, {active: false});
                    expect(activate).to.not.be(undefined);
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + activate.id + '/makeActive')
                        .end(function (e, res) {
                            catalogueNumbers = res.body.catalogueNumbers;
                            expect(_.find(catalogueNumbers, {active: true}).id).to.be.eql(activate.id);
                            expect(_.filter(catalogueNumbers, {active: true}).length).to.be(1);
                            done();
                        });


                });
        });

        it('Make active already active', function (done) {
            var stamp = {
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
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var catalogueNumbers = res.body.catalogueNumbers;
                    var activate = _.find(catalogueNumbers, {active: true});
                    expect(activate).to.not.be(undefined);
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + activate.id + '/makeActive')
                        .end(function (e, res) {
                            expect(res.statusCode).to.be(200);
                            catalogueNumbers = res.body.catalogueNumbers;
                            expect(_.find(catalogueNumbers, {active: true}).id).to.be.eql(activate.id);
                            expect(_.filter(catalogueNumbers, {active: true}).length).to.be(1);
                            done();
                        });


                });
        });

        it('DELETE no existing ID', function (done) {
            superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + 800020)
                .end(function (e, res) {
                    expect(res.statusCode).to.be(404);
                    done();
                });
        });
        it('DELETE catalogue number directly', function (done) {
            var stamp = {
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
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var catalogueNumbers = res.body.catalogueNumbers;
                    var nonActive = _.find(catalogueNumbers, {active: false});
                    var stampId = res.body.id;
                    expect(nonActive).to.not.be(undefined);
                    superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + nonActive.id)
                        .end(function (e, res) {
                            expect(res.statusCode).to.be(204);
                            superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps/' + stampId)
                                .end(function (e, res) {
                                    expect(res.body.catalogueNumbers.length).to.be(1);
                                });
                            done();
                        });
                });
        });
    });

})(describe,it,after,before);