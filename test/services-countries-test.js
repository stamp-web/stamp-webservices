var superagent = require('superagent');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');
var stampUtil = require('./util/stamp-utilities');
var _ = require('lodash');

describe('REST Services for Countries', () => {

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

    it('countStamps will execute with no stamps in system', done => {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/countries/!countStamps')
            .end(function (e, res) {
                expect(e).toBe(null);
                expect(res.status).toEqual(200);
                let result = res.body;
                expect(_.isEmpty(result)).toBe(true);
                done();
            });
    });

    it('GET Collection with 200 status', done => {
        NamedCollectionVerifications.verifyCollection("countries", done);
    });

    it('GET by ID with 200 status', done => {
        NamedCollectionVerifications.verifySingleItem('countries', {
            id:   2,
            name: 'Canada'
        }, done);
    });

    it('GET collection with Name query with 200 status', done => {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/countries?$filter=(name eq \'Canada\')')
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(200);
                expect(res.body.total).toEqual(1);
                expect(res.body.countries).not.toBe(undefined);
                var country = res.body.countries[0];
                expect(country.name).toEqual("Canada");
                expect(country.id).toEqual(2);
                done();
            });
    });

    it('GET by invalid ID with 404 status', done => {
        NamedCollectionVerifications.verifyNotFound('countries', done);
    });

    it('POST valid creation with 201 status', done => {
        NamedCollectionVerifications.verifyPost('countries', {
            name: 'German States - Bavaria', description: 'State of Germany'
        }, done);
    });

    it('POST duplicate creation with 409 status', done => {
        superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({name: 'German States - Prussia'})
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var body = res.body;
                delete body.id;
                superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                    .send(body).end(function (msg, res) {
                    expect(msg).not.toEqual(null);
                    expect(res.status).toEqual(409);
                    done();
                });
            });
    });

    it('POST missing name field with 400 status', done => {
        superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({description: 'some description'})
            .end(function (msg, res) {
                expect(msg).not.toEqual(null);
                expect(res.status).toEqual(400);
                done();
            });
    });

    it('PUT successfully with 200 status', done => {
        var name = 'POST success';
        superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({name: name})
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var id = res.body.id;
                superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                    .send({name: 'PUT update', description: 'Description on update'})
                    .end(function (e, res) {
                        expect(e).toEqual(null);
                        expect(res.status).toEqual(200);
                        expect(res.body.name).toEqual('PUT update');
                        expect(res.body.description).toEqual('Description on update');
                        done();
                    });
            });
    });

    it('PUT successfully changing image paths on stamps', done => {
        var name = 'Country Test' + (new Date()).getTime();
        superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({name: name})
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var id = res.body.id;
                var stamp = {
                    id:              (new Date()).getTime() % 1024,
                    countryRef:      id,
                    stampOwnerships: [{
                        albumRef:  2,
                        condition: 2,
                        grade:     1,
                        img:       name + '/55.jpg'
                    }]
                };
                stampUtil.create(stamp, function (e, res) {
                    superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + id + '?modifyImagePath=true')
                        .send({name: 'Another Country Name'})
                        .end(function (e, res) {
                            expect(e).toEqual(null);
                            expect(res.status).toEqual(200);
                            expect(res.body.name).toEqual('Another Country Name');
                            superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps?$filter=(countryRef eq ' + id + ')')
                                .end(function (e, res) {
                                    expect(e).toEqual(null);
                                    expect(res.body.total).toBeGreaterThan(0);
                                    var stamp = res.body.stamps[0];
                                    var ownership = stamp.stampOwnerships[0];
                                    expect(ownership.img).toEqual('Another Country Name/55.jpg');
                                    done();
                                });
                        });
                });

            });
    });

    it('PUT with invalid non-existing ID', done => {
        NamedCollectionVerifications.verifyPutNotFound('countries', {description: 'some description'}, done);
    });

    it('PUT causing a conflict', done => {
        var conflict_name = 'PUT with conflict (orignial)';
        superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({name: conflict_name})
            .end((e, res) => {
                expect(e).toBe(null);
                expect(res.status).toBe(201);
                superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                    .send({name: 'PUT causing conflict'})
                    .end((e, res) =>{
                        expect(e).toBe(null);
                        expect(res.status).toBe(201);
                        let id = res.body.id;
                        // Now verify it is not found.
                        superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                            .send({name: conflict_name})
                            .end((msg, res) => {
                                expect(msg).not.toBe(null);
                                expect(res.status).toBe(409);
                                done();
                            });
                    });
            });
    });

    it('DELETE no existing ID', done => {
        NamedCollectionVerifications.verifyDeleteNotFound('countries', done);
    });

    it('DELETE successful with no retained state', done => {
        NamedCollectionVerifications.verifyDelete('countries', {name: 'Test Delete'}, done);
    });

    it('DELETE cascade to ALBUMS_COUNTRIES', done => {
        NamedCollectionVerifications.verifyPost('countries', {
            name: 'Test of Country Delete Cascade'
        }, undefined, function (country) {
            NamedCollectionVerifications.verifyPost('albums', {
                name: 'Test of Country Delete Cascade', countries: [country.id], stampCollectionRef: 1
            }, undefined, function (album) {
                superagent.del('http://' + hostname + ':' + server_port + '/rest/countries/' + country.id)
                    .end(function (e, res) {
                        expect(e).toEqual(null);
                        expect(res.status).toBe(204);
                        superagent.get('http://' + hostname + ':' + server_port + '/rest/albums/' + album.id)
                            .end(function (e, res) {
                                expect(e).toEqual(null);
                                expect(res.status).toBe(200);
                                expect(res.body.countries.length).toBe(0);
                                done();
                            });
                    });
            });
        });
    });

    it('DELETE successfully removes associated stamp(s).', done => {
        NamedCollectionVerifications.verifyPost('countries', {
            name: 'Test of Delete Country_ID'
        }, undefined, function (country) {
            // seller is now created and available for evaluation
            connection.query('INSERT INTO STAMPS (ID,COUNTRY_ID,DENOMINATION) VALUES(80201,' + country.id + ',"1d")', function (err, data) {
                if (err) {
                    throw Error("could not save stamp");
                }
                superagent.del('http://' + hostname + ':' + server_port + '/rest/countries/' + country.id)
                    .end(function (e, res) {
                        expect(e).toEqual(null);
                        expect(res.status).toBe(204);
                        connection.query('SELECT COUNT(DISTINCT ID) AS count FROM STAMPS WHERE COUNTRY_ID=' + country.id, function (err, data) {
                            expect(err).toBe(null);
                            expect(data[0].count).toBe(0);
                            done();
                        });
                    });
            });
        });
    });
});
