var superagent = require('superagent');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

describe('REST Services for Stamp Collections', () => {

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
        NamedCollectionVerifications.verifyCollection('stampCollections', done);
    });

    it('GET by ID with 200 status', done => {
        NamedCollectionVerifications.verifySingleItem('stampCollections', {
            id:   1,
            name: 'British Commonwealth'
        }, done);
    });

    it('GET collection with Name query with 200 status', done => {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/stampCollections?$filter=(name eq \'British Commonwealth\')')
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(200);
                expect(res.body.total).toEqual(1);
                expect(res.body.stampCollections).not.toBe(undefined);
                var collection = res.body.stampCollections[0];
                expect(collection.name).toEqual("British Commonwealth");
                expect(collection.id).toEqual(1);
                done();
            });
    });

    it('GET by invalid ID with 404 status', done => {
        NamedCollectionVerifications.verifyNotFound('stampCollections', done);
    });


    it('POST valid creation with 201 status', done => {
        NamedCollectionVerifications.verifyPost('stampCollections', {
            name: 'The World Collection', description: 'Stamps of the world'
        }, done);
    });

    it('POST duplicate creation with 409 status', done => {
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
            .send({name: 'German States'})
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var body = res.body;
                delete body.id;
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
                    .send(body).end(function (msg, res) {
                    expect(msg).not.toEqual(null);
                    expect(res.status).toEqual(409);
                    done();
                });
            });
    });

    it('POST missing name field with 400 status', done => {
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
            .send({description: 'some description'})
            .end(function (msg, res) {
                expect(msg).not.toEqual(null);
                expect(res.status).toEqual(400);
                done();
            });
    });

    it('PUT successfully with 200 status', done => {
        var name = 'POST album';
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
            .send({name: name})
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var id = res.body.id;
                superagent.put('http://' + hostname + ':' + server_port + '/rest/stampCollections/' + id)
                    .send({name: 'PUT collection', description: 'Description on update'})
                    .end(function (e, res) {
                        expect(e).toEqual(null);
                        expect(res.status).toEqual(200);
                        expect(res.body.name).toEqual('PUT collection');
                        expect(res.body.description).toEqual('Description on update');
                        done();
                    });
            });
    });

    it('PUT with invalid non-existing ID', done => {
        NamedCollectionVerifications.verifyPutNotFound('stampCollections', {value: 'some description'}, done);
    });

    it('PUT causing a conflict', done => {
        var conflict_name = 'PUT with conflict (orignial)';
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
            .send({name: conflict_name})
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
                    .send({name: 'PUT causing conflict'})
                    .end(function (e, res) {
                        expect(e).toEqual(null);
                        expect(res.status).toEqual(201);
                        var id = res.body.id;
                        superagent.put('http://' + hostname + ':' + server_port + '/rest/stampCollections/' + id)
                            .send({name: conflict_name})
                            .end(function (msg, res) {
                                expect(msg).not.toEqual(null);
                                expect(res.status).toEqual(409);
                                done();
                            });
                    });
            });
    });

    it('DELETE no existing ID', done => {
        NamedCollectionVerifications.verifyDeleteNotFound('stampCollections', done);
    });

    it('DELETE successful removes albums and countries', done => {
        var count = 0;
        var total = 10;
        var id = -1;

        superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
            .send({name: "DeletingStampCollection"})
            .end(function (e, res) {
                id = res.body.id;
                if (id > 0) {
                    var post = function (name, callback) {
                        superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                            .send({name: name, stampCollectionRef: id})
                            .end(function (e, res) {
                                callback();
                            });
                    };
                    var postCallback = function () {
                        count++;
                        if (count !== total) {
                            post("Album-" + count, postCallback);
                        }
                    };
                    post("Album-" + count, postCallback);
                    var theInterval;
                    var f = function () {
                        if (count === total) {
                            clearInterval(theInterval);
                            superagent.del('http://' + hostname + ':' + server_port + '/rest/stampCollections/' + id)
                                .end(function (e, res) {
                                    expect(e).toEqual(null);
                                    expect(res.status).toEqual(204);
                                    // should be a LIKE filter but that is not supported yet
                                    superagent.get('http://' + hostname + ':' + server_port + '/rest/albums?$filter=(name eq \'Album-5\')')
                                        .end(function (e, res) {
                                            expect(res.body.total).toEqual(0);
                                            done();
                                        });
                                });
                        }
                    };
                    theInterval = setInterval(f, 50);
                } else {
                    throw Error("No id is available.");
                }
            });
    });

});
