const superagent = require('superagent');
const session = require('./util/integration-session');
const NamedCollectionVerifications = require('./util/named-collection-verifier');

describe('REST Services for Stamp Collections', () => {

    let hostname, server_port;

    afterAll(done => {
        session.cleanup(() => {
            done();
        });
    });

    beforeAll(done => {
        session.initialize( () => {
            hostname = session.getHostname();
            server_port = session.getPort();
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
        superagent.get(`http://${hostname}:${server_port}/rest/stampCollections?$filter=(name eq 'British Commonwealth')`)
            .end((e, res) => {
                expect(e).toEqual(null);
                expect(res.status).toEqual(200);
                expect(res.body.total).toEqual(1);
                expect(res.body.stampCollections).not.toBe(undefined);
                const collection = res.body.stampCollections[0];
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
        superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({name: 'German States'})
            .end((e, res) => {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                const body = res.body;
                delete body.id;
                superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
                    .send(body).end((msg, res) => {
                    expect(msg).not.toEqual(null);
                    expect(res.status).toEqual(409);
                    done();
                });
            });
    });

    it('POST missing name field with 400 status', done => {
        superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({description: 'some description'})
            .end((msg, res) => {
                expect(msg).not.toEqual(null);
                expect(res.status).toEqual(400);
                done();
            });
    });

    it('PUT successfully with 200 status', done => {
        const name = 'POST album';
        superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({name: name})
            .end((e, res) => {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                const id = res.body.id;
                superagent.put(`http://${hostname}:${server_port}/rest/stampCollections/${id}`)
                    .send({name: 'PUT collection', description: 'Description on update'})
                    .end((e, res) => {
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
        const conflict_name = 'PUT with conflict (orignial)';
        superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({name: conflict_name})
            .end((e, res) => {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
                    .send({name: 'PUT causing conflict'})
                    .end((e, res) => {
                        expect(e).toEqual(null);
                        expect(res.status).toEqual(201);
                        const id = res.body.id;
                        superagent.put(`http://${hostname}:${server_port}/rest/stampCollections/${id}`)
                            .send({name: conflict_name})
                            .end((msg, res) => {
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
        let count = 0;
        const total = 10;
        let id = -1;

        superagent.post(`http://${hostname}:${server_port}/rest/stampCollections`)
            .send({name: "DeletingStampCollection"})
            .end( (e, res) => {
                id = res.body.id;
                if (id > 0) {
                    const post = (name, callback) => {
                        superagent.post(`http://${hostname}:${server_port}/rest/albums`)
                            .send({name: name, stampCollectionRef: id})
                            .end(() => {
                                callback();
                            });
                    };
                    const postCallback = () => {
                        count++;
                        if (count !== total) {
                            post(`Album-${count}`, postCallback);
                        }
                    };
                    post(`Album-${count}`, postCallback);
                    let theInterval;
                    const f = function () {
                        if (count === total) {
                            clearInterval(theInterval);
                            superagent.del(`http://${hostname}:${server_port}/rest/stampCollections/${id}`)
                                .end(function (e, res) {
                                    // eslint-disable-next-line jest/no-conditional-expect
                                    expect(e).toEqual(null);
                                    // eslint-disable-next-line jest/no-conditional-expect
                                    expect(res.status).toEqual(204);
                                    // should be a LIKE filter but that is not supported yet
                                    superagent.get(`http://${hostname}:${server_port}/rest/albums?$filter=(name eq 'Album-5')`)
                                        .end(function (e, res) {
                                            // eslint-disable-next-line jest/no-conditional-expect
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
