const superagent = require('superagent');
const session = require('./util/integration-session');
const NamedCollectionVerifications = require('./util/named-collection-verifier');


describe('REST Services for Catalogues', () => {

    let hostname, server_port;

    afterAll(done => {
        session.cleanup(() => {
            done();
        });
    });

    beforeAll(done => {
        session.initialize(() => {
            hostname = session.getHostname();
            server_port = session.getPort();
            done();
        });
    });

    it('GET Collection with 200 status', done => {
        NamedCollectionVerifications.verifyCollection('catalogues', undefined, (obj) => {
            expect(obj.issue).not.toBe(null);
            expect(obj.type).not.toBe(null);
            done();
        });
    });
    it('GET by ID with 200 status', done => {
        NamedCollectionVerifications.verifySingleItem('catalogues', {
            id:    1,
            name:  'Stamps of the world',
            issue: 2014,
            type:  0
        }, undefined, (obj) => {
            expect(obj.issue).toEqual(2014);
            expect(obj.type).toEqual(0);
            done();
        });
    });
    it('GET by invalid ID with 404 status', done => {
        NamedCollectionVerifications.verifyNotFound('catalogues', done);
    });

    it('PUT with invalid non-existing ID', done => {
        NamedCollectionVerifications.verifyPutNotFound('catalogues', {description: 'some value'}, done);
    });

    it('POST valid creation with 201 status', done => {
        NamedCollectionVerifications.verifyPost('catalogues', {
            name: 'Scott Postage Specialized', issue: 2012, type: 1, code: 'USD', description: 'Detailed specialized'
        }, undefined, (obj) => {
            expect(obj.issue).toEqual(2012);
            expect(obj.type).toEqual(1);
            expect(obj.code).toEqual('USD');
            done();
        });
    });

    it('DELETE successful with no retained state', done => {
        NamedCollectionVerifications.verifyDelete('catalogues', {
            name: 'Deleting Catalogue', issue: 2014, type: 2, currency: 'CAD'
        }, done);
    });

    it('DELETE vetoed for orphaned stamps', done => {
        NamedCollectionVerifications.verifyPost('catalogues', {
            name: 'Unable to delete orphans', issue: 2014, type: 1
        }, undefined, (obj) => {
            const id = obj.id;
            const stamp = {
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
            superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
                .send(stamp)
                .end((e, res) => {
                    expect(res.status).toBe(201);
                    superagent.del(`http://${hostname}:${server_port}/rest/catalogues/${id}`)
                        .end((e, res) => {
                            expect(res.status).toBe(409);
                            done();
                        });
                });
        });
    });

    it('DELETE ok for secondary catalogue numbers', done => {
        NamedCollectionVerifications.verifyPost('catalogues', {
            name: 'ok to delete secondary CNs', issue: 2012, type: 2
        }, undefined, function (obj) {
            const id = obj.id;
            const stamp = {
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
            superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
                .send(stamp)
                .end((e, res) => {
                    expect(res.status).toBe(201);
                    superagent.del(`http://${hostname}:${server_port}/rest/catalogues/${id}`)
                        .end((e, res) => {
                            expect(res.status).toBe(204);
                            done();
                        });
                });
        });
    });

    it('DELETE no existing ID', done => {
        NamedCollectionVerifications.verifyDeleteNotFound('catalogues', done);
    });
});
