const _ = require('lodash');
const superagent = require('superagent');
const session = require('./util/integration-session');

describe('REST Services for Catalogue Numbers', () => {

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

    it('Make active changes successfully', done => {
        const stamp = {
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
        superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp)
            .end((e, res) => {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                let catalogueNumbers = res.body.catalogueNumbers;
                const activate = _.find(catalogueNumbers, {active: false});
                expect(activate).not.toBe(undefined);
                superagent.post(`http://${hostname}:${server_port}/rest/catalogueNumbers/${activate.id}/makeActive`)
                    .end((e, res) => {
                        catalogueNumbers = res.body.catalogueNumbers;
                        expect(_.find(catalogueNumbers, {active: true}).id).toEqual(activate.id);
                        expect(_.filter(catalogueNumbers, {active: true}).length).toBe(1);
                        done();
                    });


            });
    });

    it('Make active already active', done => {
        const stamp = {
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
        superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp)
            .end((e, res) => {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                let catalogueNumbers = res.body.catalogueNumbers;
                const activate = _.find(catalogueNumbers, {active: true});
                expect(activate).not.toBe(undefined);
                superagent.post(`http://${hostname}:${server_port}/rest/catalogueNumbers/${activate.id}/makeActive`)
                    .end((e, res) => {
                        expect(res.statusCode).toBe(200);
                        catalogueNumbers = res.body.catalogueNumbers;
                        expect(_.find(catalogueNumbers, {active: true}).id).toEqual(activate.id);
                        expect(_.filter(catalogueNumbers, {active: true}).length).toBe(1);
                        done();
                    });


            });
    });

    it('DELETE no existing ID', done => {
        superagent.del(`http://${hostname}:${server_port}/rest/catalogueNumbers/800020`)
            .end((e, res) => {
                expect(res.statusCode).toBe(404);
                done();
            });
    });
    it('DELETE catalogue number directly', done => {
        const stamp = {
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
        superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp)
            .end((e, res) => {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                const catalogueNumbers = res.body.catalogueNumbers;
                const nonActive = _.find(catalogueNumbers, {active: false});
                const stampId = res.body.id;
                expect(nonActive).not.toBe(undefined);
                superagent.del(`http://${hostname}:${server_port}/rest/catalogueNumbers/${nonActive.id}`)
                    .end((e, res) => {
                        expect(res.statusCode).toBe(204);
                        superagent.get(`http://${hostname}:${server_port}/rest/stamps/${stampId}`)
                            .end((e, res) => {
                                expect(res.body.catalogueNumbers.length).toBe(1);
                            });
                        done();
                    });
            });
    });
});
