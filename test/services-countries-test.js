var superagent = require('superagent');
var expect = require('expect.js');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');
var stampUtil= require('./util/stamp-utilities');

(function (describe, it, after, before) {
    "use strict";

    describe('REST Services for Countries', function (done) {

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
            NamedCollectionVerifications.verifyCollection("countries", done);
        });

        it('GET by ID with 200 status', function (done) {
            NamedCollectionVerifications.verifySingleItem('countries', {
                id: 2,
                name: 'Canada'
            }, done);
        });

        it('GET collection with Name query with 200 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/countries?$filter=(name eq \'Canada\')')
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(200);
                    expect(res.body.total).to.be.eql(1);
                    expect(res.body.countries).to.not.be(undefined);
                    var country = res.body.countries[0];
                    expect(country.name).to.be.eql("Canada");
                    expect(country.id).to.be.eql(2);
                    done();
                });
        });

        it('GET by invalid ID with 404 status', function (done) {
            NamedCollectionVerifications.verifyNotFound('countries', done);
        });

        it('POST valid creation with 201 status', function (done) {
            NamedCollectionVerifications.verifyPost('countries', {
                name: 'German States - Bavaria', description: 'State of Germany'
            }, done);
        });

        it('POST duplicate creation with 409 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                .send({ name: 'German States - Prussia' })
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var body = res.body;
                    delete body.id;
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                        .send(body).end(function (e, res) {
                            expect(e).to.eql(null);
                            expect(res.status).to.eql(409);
                            done();
                        });
                });
        });

        it('POST missing name field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                .send({ description: 'some description' })
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(400);
                    done();
                });
        });

        it('PUT successfully with 200 status', function (done) {
            var name = 'POST success';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                .send({ name: name })
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var id = res.body.id;
                    superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                        .send({ name: 'PUT update', description: 'Description on update' })
                        .end(function (e, res) {
                            expect(e).to.eql(null);
                            expect(res.status).to.eql(200);
                            expect(res.body.name).to.eql('PUT update');
                            expect(res.body.description).to.eql('Description on update');
                            done();
                        });
                });
        });

        it('PUT successfully changing image paths on stamps', function (done) {
            var name = 'Country Test';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                .send({ name: name })
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var id = res.body.id;
                    var stamp = {
                        id: (new Date()).getTime() % 1024,
                        countryRef: id,
                        stampOwnerships: [{
                            albumRef: 2,
                            condition: 2,
                            grade: 1,
                            img: name + '/55.jpg'
                        }]
                    }
                    stampUtil.create(stamp, function(e, res) {
                        superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + id + '?modifyImagePath=true')
                            .send({ name: 'Another Country Name' })
                            .end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(200);
                                expect(res.body.name).to.eql('Another Country Name');
                                superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps?$filter=(countryRef eq ' + id + ')')
                                    .end(function(e,res) {
                                        expect(e).to.eql(null);
                                        expect(res.body.total).to.be.greaterThan(0);
                                        var stamp = res.body.stamps[0];
                                        var ownership = stamp.stampOwnerships[0];
                                        expect(ownership.img).to.eql('Another Country Name/55.jpg' );
                                        done();
                                    })
                            });
                    });

                });
        });

        it('PUT with invalid non-existing ID', function (done) {
            NamedCollectionVerifications.verifyPutNotFound('countries', { description: 'some description' }, done);
        });

        it('PUT causing a conflict', function (done) {
            var conflict_name = 'PUT with conflict (orignial)';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                .send({ name: conflict_name })
                .end(function (e, res) {
                    expect(e).to.be(null);
                    expect(res.status).to.be(201);
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                        .send({ name: 'PUT causing conflict' })
                        .end(function (e, res) {
                            expect(e).to.be(null);
                            expect(res.status).to.be(201);
                            var id = res.body.id;
                            // Now verify it is not found.
                            superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                                .send({ name: conflict_name })
                                .end(function (e, res) {
                                    expect(e).to.be(null);
                                    expect(res.status).to.be(409);
                                    done();
                                });
                        });
                });
        });

        it('DELETE no existing ID', function (done) {
            NamedCollectionVerifications.verifyDeleteNotFound('countries', done);
        });

        it('DELETE successful with no retained state', function (done) {
            NamedCollectionVerifications.verifyDelete('countries', { name: 'Test Delete' }, done);
        });

        it('DELETE cascade to ALBUMS_COUNTRIES', function (done) {
            NamedCollectionVerifications.verifyPost('countries', {
                name: 'Test of Country Delete Cascade'
            }, null, function (country) {
                NamedCollectionVerifications.verifyPost('albums', {
                    name: 'Test of Country Delete Cascade', countries: [country.id], stampCollectionRef: 1
                }, null, function (album) {
                    superagent.del('http://' + hostname + ':' + server_port + '/rest/countries/' + country.id)
                        .end(function (e, res) {
                            expect(e).to.eql(null);
                            expect(res.status).to.be(204);
                            superagent.get('http://' + hostname + ':' + server_port + '/rest/albums/' + album.id)
                                .end(function (e, res) {
                                    expect(e).to.eql(null);
                                    expect(res.status).to.be(200);
                                    expect(res.body.countries.length).to.be(0);
                                    done();
                                });
                        });
                });
            });
        });

        it('DELETE successfully removes associated stamp(s).', function (done) {
            NamedCollectionVerifications.verifyPost('countries', {
                name: 'Test of Delete Country_ID'
            }, null, function (country) {
                // seller is now created and available for evaluation
                connection.query('INSERT INTO STAMPS (ID,COUNTRY_ID,DENOMINATION) VALUES(80201,' + country.id + ',"1d")', function (err, data) {
                    if (err) {
                        expect().fail("could not save stamp", err);
                    }
                    superagent.del('http://' + hostname + ':' + server_port + '/rest/countries/' + country.id)
                        .end(function (e, res) {
                            expect(e).to.eql(null);
                            expect(res.status).to.be(204);
                            connection.query('SELECT COUNT(DISTINCT ID) AS count FROM STAMPS WHERE COUNTRY_ID=' + country.id, function (err, data) {
                                expect(err).to.be(null);
                                expect(data[0].count).to.be(0);
                                done();
                            });
                        });
                });
            });
        });
    });
})(describe,it,after,before);
