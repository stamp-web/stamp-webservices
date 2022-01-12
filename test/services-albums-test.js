var superagent = require('superagent');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

describe('REST Services for Albums', () => {

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

    it('GET Collection with 200 status', done => {
        NamedCollectionVerifications.verifyCollection('albums', undefined, function (obj) {
            expect(obj.stampCollectionRef).toBeGreaterThan(0);
            done();
        });
    });

    it('GET by ID with 200 status', done => {
        NamedCollectionVerifications.verifySingleItem('albums', {
            id:   1,
            name: 'Australia'
        }, undefined, function (obj) {
            expect(obj.stampCollectionRef).toEqual(1);
            done();
        });
    });

    it('GET collection with Name query with 200 status', done => {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/albums?$filter=(name eq \'Australian States\')')
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(200);
                expect(res.body.total).toEqual(1);
                expect(res.body.albums).not.toBe(undefined);
                var album = res.body.albums[0];
                expect(album.name).toEqual("Australian States");
                expect(album.id).toEqual(2);
                done();
            });
    });

    it('GET by invalid ID with 404 status', done => {
        NamedCollectionVerifications.verifyNotFound('albums', done);
    });

    it('POST valid creation with 201 status', done => {
        NamedCollectionVerifications.verifyPost('albums', {
            name: 'British Europe', stampCollectionRef: 1, description: 'European countries'
        }, undefined, function (obj) {
            expect(obj.stampCollectionRef).toEqual(1);
            done();
        });
    });

    it('POST duplicate creation with 409 status', done => {
        superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({name: 'German States', stampCollectionRef: 1})
            .end(function (e, res) {
                expect(res.status).toEqual(201);
                var body = res.body;
                delete body.id;
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                    .send(body).end(function (e, res) {
                    expect(e).not.toEqual(null);
                    expect(res.status).toEqual(409);
                    done();
                });
            });
    });

    it('POST missing name field with 400 status', done => {
        superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({description: 'some description'})
            .end(function (e, res) {
                expect(e).not.toEqual(null);
                expect(res.status).toEqual(400);
                done();
            });
    });

    it('POST missing stamp collection ref field with 400 status', done => {
        superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({name: 'Some album'})
            .end(function (e, res) {
                expect(e).not.toEqual(null);
                expect(res.status).toEqual(400);
                done();
            });
    });

    it('Move album to new collection', done => {
        var name = 'Move Album';
        superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({name: name, stampCollectionRef: 1})
            .end(function (e, res) {
                expect(res.status).toEqual(201);
                var id = res.body.id;
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums/' + id + '/moveTo/2').end(function (e, res) {
                    expect(res.status).toBe(200);
                    var body = res.body;
                    expect(body.name).toEqual('Move Album');
                    expect(body.stampCollectionRef).toEqual(2);
                    done();
                });
            });
    });

    it('PUT successfully with 200 status', done => {
        var name = 'POST album';
        superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({name: name, stampCollectionRef: 1, countries: [1]})
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var id = res.body.id;
                superagent.put('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                    .send({name: 'PUT album', description: 'Description on update', countries: [2]})
                    .end(function (e, res) {
                        expect(e).toEqual(null);
                        expect(res.status).toBe(200);
                        var body = res.body;
                        expect(body.name).toEqual('PUT album');
                        expect(body.description).toEqual('Description on update');
                        expect(body.countries).not.toEqual(null);
                        expect(body.countries.length).toEqual(1);
                        expect(body.countries[0]).toEqual(2);
                        done();
                    });
            });
    });

    it('PUT with invalid non-existing ID', done => {
        NamedCollectionVerifications.verifyPutNotFound('albums', {description: 'some description'}, done);
    });

    it('PUT causing a conflict', done => {
        var conflict_name = 'PUT with conflict (orignial)';
        superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({name: conflict_name, stampCollectionRef: 1})
            .end(function (e, res) {
                expect(res.status).toEqual(201);
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                    .send({name: 'PUT causing conflict', stampCollectionRef: 1})
                    .end(function (e, res) {
                        expect(res.status).toEqual(201);
                        var id = res.body.id;
                        // Now verify it is not found.
                        superagent.put('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                            .send({name: conflict_name})
                            .end(function (e, res) {
                                expect(e).not.toEqual(null);
                                expect(res.status).toEqual(409);
                                done();
                            });
                    });
            });
    });

    it('DELETE no existing ID', done => {
        NamedCollectionVerifications.verifyDeleteNotFound('albums', done);
    });

    it('DELETE successful with cascade to ALBUMS_COUNTRIES', done => {
        NamedCollectionVerifications.verifyDelete('albums', {
            name: 'TEST DELETE', stampCollectionRef: 1, countries: [1]
        }, done, function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/countries/1').end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(200);
                expect(res.body.id).toEqual(1);
                done();
            });
        });
    });

    it('DELETE removes Ownership but retains Stamp with updated ModifyStamp', done => {
        NamedCollectionVerifications.verifyPost('albums', {
            name: 'An Album to behold', stampCollectionRef: 1, description: 'European countries'
        }, null, function (obj) {
            var albumID = obj.id;
            var stamp = {
                countryRef:       1,
                rate:             "1d",
                description:      "reddish brown",
                wantList:         false,
                catalogueNumbers: [
                    {
                        catalogueRef: 1,
                        number:       "23a",
                        value:        0.65,
                        condition:    1,
                        active:       true
                    }
                ],
                stampOwnerships:  [
                    {
                        albumRef: albumID
                    }
                ]
            };
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(e).toEqual(null);
                    expect(res.status).toEqual(201);
                    var stampId = res.body.id;
                    superagent.del('http://' + hostname + ':' + server_port + '/rest/albums/' + albumID)
                        .end(function (e, res) {
                            expect(e).toEqual(null);
                            expect(res.status).toEqual(204);
                            superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps/' + stampId)
                                .end(function (e, res) {
                                    expect(e).toEqual(null);
                                    expect(res.body.stampOwnerships.length).toBe(0);
                                    done();
                                });
                        });
                });
        });

    });
});
