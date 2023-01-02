var _ = require('lodash');
var superagent = require('superagent');
var session = require('./util/integration-session');
var stampUtil = require('./util/stamp-utilities');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

describe('REST Services for Stamps', () => {

    var hostname, server_port, connection;

    afterAll(done => {
        session.cleanup( () => {
            done();
        });
    });

    beforeAll(done => {
        session.initialize(() => {
            hostname = session.getHostname();
            server_port = session.getPort();
            connection = session.getConnection();
            done();
        });
    });
    it('POST valid creation with 201 status', done => {
        var stamp = {
            countryRef:       1,
            rate:             "1d",
            description:      "red",
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
                    albumRef:  2,
                    condition: 2,
                    grade:     1,
                    notes:     "this is a note",
                    pricePaid: 0.25,
                    code:      "USD",
                    sellerRef: 1,
                    purchased: "2007-05-15T00:00:00-05:00"
                }
            ]
        };
        stampUtil.create(stamp, function (e, res) {
            var result = res.body;
            expect(result.id).toBeGreaterThan(1000);
            expect(result.rate).toEqual("1d");
            expect(result.description).toEqual("red");
            expect(result.countryRef).toBe(1);
            var catalogueNumbers = res.body.catalogueNumbers;
            expect(catalogueNumbers.length).toBe(1);
            expect(catalogueNumbers[0].id).toBeGreaterThan(1000);
            expect(catalogueNumbers[0].value > 0.64999 && catalogueNumbers[0].value < 0.65001).toBeTruthy();
            expect(catalogueNumbers[0].number).toEqual("23a");
            expect(catalogueNumbers[0].condition).toBe(1);
            expect(catalogueNumbers[0].active).toBe(true);
            var ownership = res.body.stampOwnerships[0];
            expect(ownership.grade).toBe(1);
            expect(ownership.condition).toBe(2);
            expect(ownership.albumRef).toBe(2);
            expect(ownership.notes).toEqual("this is a note");
            expect(ownership.pricePaid > 0.24999 && ownership.pricePaid < 0.25001).toBeTruthy();
            expect(ownership.code).toEqual("USD");
            expect(ownership.sellerRef).toBe(1);
            expect(ownership.purchased.indexOf("2007-05-15")).toBe(0);
            done();
        });
    });

    it('POST for descriptions with apostrophes (issue #48)', done => {
        var description = "blackish opal-green (rotary press printing - 1'5'1)";
        var stamp = {
            countryRef:       1,
            rate:             "30pf",
            description:      description,
            wantList:         true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "172 W OR",
                    value:        2.50,
                    condition:    1,
                    active:       true
                }
            ]
        };
        stampUtil.create(stamp, function (e, res) {
            var result = res.body;
            expect(result.id).toBeGreaterThan(1000);
            expect(result.rate).toEqual("30pf");
            expect(result.description).toEqual(description);
            expect(result.countryRef).toBe(1);
            var catalogueNumbers = res.body.catalogueNumbers;
            expect(catalogueNumbers.length).toBe(1);
            expect(catalogueNumbers[0].id).toBeGreaterThan(1000);
            expect(catalogueNumbers[0].value > 2.4999 && catalogueNumbers[0].value < 2.5001).toBeTruthy();
            expect(catalogueNumbers[0].number).toEqual("172 W OR");
            expect(catalogueNumbers[0].condition).toBe(1);
            expect(catalogueNumbers[0].active).toBe(true);
            done();
        });
    });

    it('GET collection with multiple conditions in OR with countryRef', done => {
        NamedCollectionVerifications.verifyPost('countries', {
            name: 'test-multiple-conditions'
        }, null, function (country) {
            var stamp = {
                countryRef:       country.id,
                rate:             "1d",
                description:      "red",
                wantList:         true,
                catalogueNumbers: [
                    {
                        catalogueRef: 1,
                        number:       "or-test-1",
                        value:        0.65,
                        condition:    1,
                        active:       true
                    }
                ]
            };
            stampUtil.create(stamp, function (e, res) {
                stamp = {
                    countryRef:       country.id,
                    rate:             "2d",
                    description:      "green",
                    wantList:         true,
                    catalogueNumbers: [
                        {
                            catalogueRef: 1,
                            number:       "or-test-2",
                            value:        1.25,
                            condition:    2, // set to a condition not included in test
                            active:       true
                        }
                    ]
                };
                stampUtil.create(stamp, function (e, res) {
                    superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps?$filter=(countryRef eq ' + country.id + ' and ((condition eq 1) or (condition eq 4)))')
                        .end(function (e, res) {
                            expect(e).toEqual(null);
                            expect(res.status).toEqual(200);
                            expect(res.body.total).toEqual(1);
                            expect(res.body.stamps).not.toBe(undefined);
                            done();
                        });
                });
            });
        });

    });


    it('POST with apostrophe is valid creation with 201 status (Issue #36)', done => {
        var stamp = {
            countryRef:       1,
            rate:             "1d'ish",
            description:      "Lidth's Jay",
            wantList:         false,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "ss'5",
                    value:        25.4,
                    condition:    1,
                    active:       true
                }
            ],
            stampOwnerships:  [
                {
                    albumRef:  2,
                    condition: 2,
                    grade:     1,
                    notes:     "this is a note of happy day of you'll love",
                    pricePaid: 0.25,
                    code:      "USD",
                    sellerRef: 1,
                    purchased: "2007-05-15T00:00:00-05:00"
                }
            ]
        };
        stampUtil.create(stamp, function (e, res) {
            var result = res.body;
            expect(result.id).toBeGreaterThan(1000);
            expect(result.rate).toEqual("1d'ish");
            expect(result.description).toEqual("Lidth's Jay");
            var catalogueNumbers = res.body.catalogueNumbers;
            expect(catalogueNumbers.length).toBe(1);
            expect(catalogueNumbers[0].number).toEqual("ss'5");
            var ownership = res.body.stampOwnerships[0];
            expect(ownership.notes).toEqual("this is a note of happy day of you'll love");
            done();
        });
    });

    it('POST purchase updates stamps (Issue #61)', done => {
        let stamp = {
            countryRef:       1,
            rate:             "1d",
            description:      "red",
            wantList:         false,
            catalogueNumbers: [
                {
                    catalogueRef: 2,
                    number:       "54a",
                    value:        100.0,
                    active:       true
                }
            ],
            stampOwnerships:  [
                {
                    albumRef:  2,
                    pricePaid: 25.0,
                    code:      'AUD'
                }
            ]
        };
        stampUtil.create(stamp, (e, res) => {
            let result = res.body;
            let id = result.id;
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps/purchase')
                .send({stamps: [id], pricePaid: 50, currencyCode: 'USD'})
                .end((e, res) => {
                    expect(res.status).toEqual(200);
                    superagent.get(`http://${hostname}:${server_port}/rest/stamps/${id}`).send()
                        .end((e, res) => {
                            expect(res.body.stampOwnerships[0].pricePaid).toEqual(50.0);
                            expect(res.body.stampOwnerships[0].code).toEqual('USD');
                            done();
                        });

                });
        });
    });

    it('POST Create a wantlist stamp with 201 status', done => {
        var stamp = {
            countryRef:       1,
            rate:             "3d",
            description:      "yellow-green",
            wantList:         true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "45",
                    value:        0.75,
                    condition:    1,
                    active:       true
                }
            ]
        };
        stampUtil.create(stamp, function (e, res) {
            expect(res.body.stampOwnerships).not.toBe(undefined);
            expect(res.body.stampOwnerships.length).toBe(0);
            done();
        });
    });

    it('Verify trigger behavior on INSERT/DELETE catalogue numbers', done => {
        var stamp = {
            countryRef:       1,
            rate:             "6d",
            description:      "yellow",
            wantList:         false,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "45",
                    value:        5.65,
                    condition:    1,
                    active:       true
                },
                {
                    catalogueRef: 1,
                    number:       "45a",
                    value:        56.23,
                    condition:    0,
                    active:       false
                }
            ],
            stampOwnerships:  []
        };
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
            .send(stamp)
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                var id = res.body.id;
                var query = function (count, callback) {
                    connection.query('SELECT CATALOGUE_COUNT FROM STAMPS WHERE ID=' + id, function (err, data) {
                        if (err) {
                            throw Error("could not get catalogue_count");
                        }
                        expect(data[0].CATALOGUE_COUNT).toBe(count);
                        callback();
                    });
                };
                query(2, function () {
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers')
                        .send({
                                catalogueRef: 1,
                                number:       67,
                                value:        677,
                                active:       false,
                                stampRef:     id
                            }
                        ).end(function (e, res) {
                        expect(e).toEqual(null);
                        expect(res.status).toEqual(201);
                        var catID = res.body.id;
                        query(3, function () {
                            superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + catID)
                                .end(function (e, res) {
                                    expect(e).toEqual(null);
                                    expect(res.status).toEqual(204);
                                    query(2, done);
                                });
                        });
                    });
                });

            });
    });

    it('PUT Convert a wantlist to a stamp with 200 status', done => {
        var stamp = {
            countryRef:       1,
            rate:             "3d",
            description:      "orange",
            wantList:         true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "46",
                    value:        12.50,
                    condition:    1,
                    unknown:      true,
                    nospace:      true,
                    active:       true
                }
            ]
        };
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
            .send(stamp)
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                expect(res.body.stampOwnerships).not.toBe(undefined);
                expect(res.body.stampOwnerships.length).toBe(0);
                expect(res.body.catalogueNumbers[0].unknown).toBe(true);
                expect(res.body.catalogueNumbers[0].nospace).toBe(true);
                stamp = res.body;
                stamp.rate = "3-1/2d";
                stamp.description = "orange-red";
                stamp.wantList = false;
                stamp.catalogueNumbers[0].value = 25.5;
                stamp.catalogueNumbers[0].nospace = false;
                stamp.stampOwnerships = [];
                stamp.stampOwnerships.push({
                    albumRef:  2,
                    condition: 2,
                    grade:     1,
                    notes:     "this is a note",
                    pricePaid: 0.25,
                    code:      "USD"
                });
                superagent.put('http://' + hostname + ':' + server_port + '/rest/stamps/' + stamp.id)
                    .send(stamp)
                    .end(function (e, res) {
                        expect(e).toEqual(null);
                        expect(res.status).toEqual(200);
                        expect(res.body.stampOwnerships).not.toBe(undefined);
                        expect(res.body.stampOwnerships.length).toBe(1);
                        expect(res.body.stampOwnerships[0].albumRef).toBe(2);
                        expect(res.body.stampOwnerships[0].condition).toBe(2);
                        expect(res.body.stampOwnerships[0].grade).toBe(1);
                        expect(res.body.stampOwnerships[0].id).toBeGreaterThan(1000);
                        expect(res.body.catalogueNumbers[0].nospace).toBe(false);
                        expect(res.body.wantList).toBe(false);
                        done();
                    });
            });
    });

    it('GET Collection with 200 status', done => {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps')
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(200);
                expect(res.body.stamps).not.toBe(undefined);
                expect(res.body.total).toBeGreaterThan(0);
                done();
            });
    });

    it('Verify exists checking', done => {
        var stamp = {
            countryRef:       1,
            rate:             "6d",
            description:      "green",
            wantList:         true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "26",
                    value:        57.50,
                    condition:    1,
                    unknown:      true,
                    nospace:      true,
                    active:       true
                }
            ]
        };
        superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
            .send(stamp)
            .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toBe(201);
                var existsChecks = [{
                    filter: "(((countryRef eq 1) and (catalogueRef eq 1)) and (number eq '26'))",
                    total:  1
                }, {
                    filter: "(((countryRef eq 9999) and (catalogueRef eq 1)) and (number eq '26'))",
                    total:  0
                }, {
                    filter: "(((countryRef eq 1) and (catalogueRef eq 9999)) and (number eq '26'))",
                    total:  0
                }, {
                    filter: "(((countryRef eq 1) and (catalogueRef eq 1)) and (number eq '26-9999'))",
                    total:  0
                }, {
                    filter: "(((countryRef eq 9999) and (catalogueRef eq 9999)) and (number eq '26-9999'))",
                    total:  0
                }];
                var count = 0;
                var fn = function (exists) {
                    superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps?$filter=' + exists.filter)
                        .end(function (e, res) {
                            expect(e).toBe(null);
                            expect(res.status).toBe(200);
                            count++;
                            expect(res.body.total).toBe(exists.total);
                            if (count === existsChecks.length) {
                                done();
                            }
                        });
                };
                _.each(existsChecks, function (exist) {
                    fn(exist);
                });
            });
    });
});
