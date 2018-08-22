var superagent = require('superagent');
var expect = require('expect.js');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

(function (describe, it, after, before) {
    "use strict";

    describe('REST Services for Albums', function (done) {

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
            NamedCollectionVerifications.verifyCollection('albums', done, function (obj) {
                expect(obj.stampCollectionRef).to.be.greaterThan(0);
            });
        });

        it('GET by ID with 200 status', function (done) {
            NamedCollectionVerifications.verifySingleItem('albums', {
                id: 1,
                name: 'Australia'
            }, done, function (obj) {
                expect(obj.stampCollectionRef).to.be.eql(1);
            });
        });

        it('GET collection with Name query with 200 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/albums?$filter=(name eq \'Australian States\')')
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(200);
                    expect(res.body.total).to.be.eql(1);
                    expect(res.body.albums).to.not.be(undefined);
                    var album = res.body.albums[0];
                    expect(album.name).to.be.eql("Australian States");
                    expect(album.id).to.be.eql(2);
                    done();
                });
        });

        it('GET by invalid ID with 404 status', function (done) {
            NamedCollectionVerifications.verifyNotFound('albums', done);
        });

        it('POST valid creation with 201 status', function (done) {
            NamedCollectionVerifications.verifyPost('albums', {
                name: 'British Europe', stampCollectionRef: 1, description: 'European countries'
            }, done, function (obj) {
                expect(obj.stampCollectionRef).to.be.eql(1);
            });
        });

        it('POST duplicate creation with 409 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                .send({ name: 'German States', stampCollectionRef: 1 })
                .end(function (e, res) {
                    expect(res.status).to.eql(201);
                    var body = res.body;
                    delete body.id;
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                        .send(body).end(function (e, res) {
                            expect(e).to.not.eql(null);
                            expect(res.status).to.eql(409);
                            done();
                        });
                });
        });

        it('POST missing name field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                .send({ description: 'some description' })
                .end(function (e, res) {
                    expect(e).to.not.eql(null);
                    expect(res.status).to.eql(400);
                    done();
                });
        });

        it('POST missing stamp collection ref field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                .send({ name: 'Some album' })
                .end(function (e, res) {
                    expect(e).to.not.eql(null);
                    expect(res.status).to.eql(400);
                    done();
                });
        });

        it('Move album to new collection', function(done) {
            var name = 'Move Album';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                .send({ name: name, stampCollectionRef: 1 })
                .end(function (e, res) {
                    expect(res.status).to.eql(201);
                    var id = res.body.id;
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/albums/' + id + '/moveTo/2').end(function(e,res) {
                        expect(res.status).to.be(200);
                        var body = res.body;
                        expect(body.name).to.eql('Move Album');
                        expect(body.stampCollectionRef).to.eql(2);
                        done();
                    });
                });
        });

        it('PUT successfully with 200 status', function (done) {
            var name = 'POST album';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                .send({ name: name, stampCollectionRef: 1, countries: [1] })
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var id = res.body.id;
                    superagent.put('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                        .send({ name: 'PUT album', description: 'Description on update', countries: [2] })
                        .end(function (e, res) {
                            expect(e).to.eql(null);
                            expect(res.status).to.be(200);
                            var body = res.body;
                            expect(body.name).to.eql('PUT album');
                            expect(body.description).to.eql('Description on update');
                            expect(body.countries).to.not.eql(null);
                            expect(body.countries.length).to.eql(1);
                            expect(body.countries[0]).to.eql(2);
                            done();
                        });
                });
        });

        it('PUT with invalid non-existing ID', function (done) {
            NamedCollectionVerifications.verifyPutNotFound('albums', { description: 'some description' }, done);
        });

        it('PUT causing a conflict', function (done) {
            var conflict_name = 'PUT with conflict (orignial)';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                .send({ name: conflict_name, stampCollectionRef: 1 })
                .end(function (e, res) {
                    expect(res.status).to.eql(201);
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                        .send({ name: 'PUT causing conflict', stampCollectionRef: 1 })
                        .end(function (e, res) {
                            expect(res.status).to.eql(201);
                            var id = res.body.id;
                            // Now verify it is not found.
                            superagent.put('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                                .send({ name: conflict_name })
                                .end(function (e, res) {
                                    expect(e).to.not.eql(null);
                                    expect(res.status).to.eql(409);
                                    done();
                                });
                        });
                });
        });

        it('DELETE no existing ID', function (done) {
            NamedCollectionVerifications.verifyDeleteNotFound('albums', done);
        });

        it('DELETE successful with cascade to ALBUMS_COUNTRIES', function (done) {
            NamedCollectionVerifications.verifyDelete('albums', {
                name: 'TEST DELETE', stampCollectionRef: 1, countries: [1]
            }, done, function (done) {
                superagent.get('http://' + hostname + ':' + server_port + '/rest/countries/1').end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(200);
                    expect(res.body.id).to.be.eql(1);
                    done();
                });
            });
        });

        it('DELETE removes Ownership but retains Stamp with updated ModifyStamp', function(done) {
            NamedCollectionVerifications.verifyPost('albums', {
                name: 'An Album to behold', stampCollectionRef: 1, description: 'European countries'
            }, null, function (obj) {
                var albumID = obj.id;
                var stamp = {
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
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                    .send(stamp)
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        var stampId = res.body.id;
                        superagent.del('http://' + hostname + ':' + server_port + '/rest/albums/' + albumID)
                            .end(function(e,res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(204);
                                superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps/' + stampId)
                                    .end(function(e,res) {
                                        expect(e).to.eql(null);
                                        expect(res.body.stampOwnerships.length).to.be(0);
                                        done();
                                    });
                            });
                    });
            });

        });
    });

})(describe,it,after,before);