var _ = require('lodash');
var superagent = require('superagent');
var expect = require('expect.js');
var session = require('./util/integration-session');
var stampUtil= require('./util/stamp-utilities');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

(function (describe, it, after, before) {
    "use strict";

    describe('REST Services for Stamps', function () {

        var hostname, server_port, connection;

        after(function (done) {
            session.cleanup(function() {
                done();
            });
        });

        before(function (done) {
            session.initialize(function() {
                hostname = session.getHostname();
                server_port = session.getPort();
                connection = session.getConnection();
                done();
            });
        });
        it('POST valid creation with 201 status', function (done) {
            var stamp = {
                countryRef: 1,
                rate: "1d",
                description: "red",
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
                        albumRef: 2,
                        condition: 2,
                        grade: 1,
                        notes: "this is a note",
                        pricePaid: 0.25,
                        code: "USD",
                        sellerRef: 1,
                        purchased: "2007-05-15T00:00:00-05:00"
                    }
                ]
            };
            stampUtil.create(stamp, function(e,res) {
                var result = res.body;
                expect(result.id).to.be.greaterThan(1000);
                expect(result.rate).to.be.eql("1d");
                expect(result.description).to.be.eql("red");
                expect(result.countryRef).to.be(1);
                var catalogueNumbers = res.body.catalogueNumbers;
                expect(catalogueNumbers.length).to.be(1);
                expect(catalogueNumbers[0].id).to.be.greaterThan(1000);
                expect(catalogueNumbers[0].value).to.be.within(0.64999, 0.65001);
                expect(catalogueNumbers[0].number).to.be.eql("23a");
                expect(catalogueNumbers[0].condition).to.be(1);
                expect(catalogueNumbers[0].active).to.be(true);
                var ownership = res.body.stampOwnerships[0];
                expect(ownership.grade).to.be(1);
                expect(ownership.condition).to.be(2);
                expect(ownership.albumRef).to.be(2);
                expect(ownership.notes).to.be.eql("this is a note");
                expect(ownership.pricePaid).to.be.within(0.24999, 0.25001);
                expect(ownership.code).to.be.eql("USD");
                expect(ownership.sellerRef).to.be(1);
                expect(ownership.purchased.indexOf("2007-05-15")).to.be(0);
                done();
            });
        });

        it('POST for descriptions with apostrophes (issue #48)', function (done) {
            var description = "blackish opal-green (rotary press printing - 1'5'1)";
            var stamp = {
                countryRef: 1,
                rate: "30pf",
                description: description,
                wantList: true,
                catalogueNumbers: [
                    {
                        catalogueRef: 1,
                        number: "172 W OR",
                        value: 2.50,
                        condition: 1,
                        active: true
                    }
                ]
            };
            stampUtil.create(stamp, function(e,res) {
                var result = res.body;
                expect(result.id).to.be.greaterThan(1000);
                expect(result.rate).to.be.eql("30pf");
                expect(result.description).to.be.eql(description);
                expect(result.countryRef).to.be(1);
                var catalogueNumbers = res.body.catalogueNumbers;
                expect(catalogueNumbers.length).to.be(1);
                expect(catalogueNumbers[0].id).to.be.greaterThan(1000);
                expect(catalogueNumbers[0].value).to.be.within(2.4999, 2.5001);
                expect(catalogueNumbers[0].number).to.be.eql("172 W OR");
                expect(catalogueNumbers[0].condition).to.be(1);
                expect(catalogueNumbers[0].active).to.be(true);
                done();
            });
        });

        it('GET collection with multiple conditions in OR with countryRef', function (done) {
            NamedCollectionVerifications.verifyPost('countries', {
                name: 'test-multiple-conditions'
            }, null, function(country) {
                var stamp = {
                    countryRef: country.id,
                    rate: "1d",
                    description: "red",
                    wantList: true,
                    catalogueNumbers: [
                        {
                            catalogueRef: 1,
                            number: "or-test-1",
                            value: 0.65,
                            condition: 1,
                            active: true
                        }
                    ]
                };
                stampUtil.create(stamp, function (e, res) {
                    stamp = {
                        countryRef: country.id,
                        rate: "2d",
                        description: "green",
                        wantList: true,
                        catalogueNumbers: [
                            {
                                catalogueRef: 1,
                                number: "or-test-2",
                                value: 1.25,
                                condition: 2, // set to a condition not included in test
                                active: true
                            }
                        ]
                    };
                    stampUtil.create(stamp, function (e, res) {
                        superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps?$filter=(countryRef eq ' + country.id + ' and ((condition eq 1) or (condition eq 4)))')
                            .end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(200);
                                expect(res.body.total).to.be.eql(1);
                                expect(res.body.stamps).to.not.be(undefined);
                                done();
                            });
                    });
                });
            });

        });


        it('POST with apostrophe is valid creation with 201 status (Issue #36)', function (done) {
            var stamp = {
                countryRef: 1,
                rate: "1d'ish",
                description: "Lidth's Jay",
                wantList: false,
                catalogueNumbers: [
                    {
                        catalogueRef: 1,
                        number: "ss'5",
                        value: 25.4,
                        condition: 1,
                        active: true
                    }
                ],
                stampOwnerships: [
                    {
                        albumRef: 2,
                        condition: 2,
                        grade: 1,
                        notes: "this is a note of happy day of you'll love",
                        pricePaid: 0.25,
                        code: "USD",
                        sellerRef: 1,
                        purchased: "2007-05-15T00:00:00-05:00"
                    }
                ]
            };
            stampUtil.create(stamp, function(e,res) {
                var result = res.body;
                expect(result.id).to.be.greaterThan(1000);
                expect(result.rate).to.be.eql("1d'ish");
                expect(result.description).to.be.eql("Lidth's Jay");
                var catalogueNumbers = res.body.catalogueNumbers;
                expect(catalogueNumbers.length).to.be(1);
                expect(catalogueNumbers[0].number).to.be.eql("ss'5");
                var ownership = res.body.stampOwnerships[0];
                expect(ownership.notes).to.be.eql("this is a note of happy day of you'll love");
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
                        expect(res.status).to.eql(200);
                        superagent.get(`http://${hostname}:${server_port}/rest/stamps/${id}`).send()
                            .end((e, res) => {
                                expect(res.body.stampOwnerships[0].pricePaid).to.eql(50.0);
                                expect(res.body.stampOwnerships[0].code).to.eql('USD');
                                done();
                            });

                    });
            });
        });

        it('POST Create a wantlist stamp with 201 status', function (done) {
            var stamp = {
                countryRef: 1,
                rate: "3d",
                description: "yellow-green",
                wantList: true,
                catalogueNumbers: [
                    {
                        catalogueRef: 1,
                        number: "45",
                        value: 0.75,
                        condition: 1,
                        active: true
                    }
                ]
            };
            stampUtil.create(stamp, function(e,res) {
                expect(res.body.stampOwnerships).to.not.be(undefined);
                expect(res.body.stampOwnerships.length).to.be(0);
                done();
            });
        });

        it('Verify trigger behavior on INSERT/DELETE catalogue numbers', function (done) {
            var stamp = {
                countryRef: 1,
                rate: "6d",
                description: "yellow",
                wantList: false,
                catalogueNumbers: [
                    {
                        catalogueRef: 1,
                        number: "45",
                        value: 5.65,
                        condition: 1,
                        active: true
                    },
                    {
                        catalogueRef: 1,
                        number: "45a",
                        value: 56.23,
                        condition: 0,
                        active: false
                    }
                ],
                stampOwnerships: [ ]
            };
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var id = res.body.id;
                    var query = function (count, callback) {
                        connection.query('SELECT CATALOGUE_COUNT FROM STAMPS WHERE ID=' + id, function (err, data) {
                            if (err) {
                                expect().fail("could not get catalogue_count", err);
                            }
                            expect(data[0].CATALOGUE_COUNT).to.be(count);
                            callback();
                        });
                    };
                    query(2, function () {
                        superagent.post('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers')
                            .send({
                                catalogueRef: 1,
                                number: 67,
                                value: 677,
                                active: false,
                                stampRef: id
                            }
                        ).end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(201);
                                var catID = res.body.id;
                                query(3, function() {
                                    superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + catID)
                                        .end(function(e,res)
                                        {
                                            expect(e).to.eql(null);
                                            expect(res.status).to.eql(204);
                                            query(2,done);
                                        });
                                });
                            });
                    });

                });
        });

        it('PUT Convert a wantlist to a stamp with 200 status', function (done) {
            var stamp = {
                countryRef: 1,
                rate: "3d",
                description: "orange",
                wantList: true,
                catalogueNumbers: [
                    {
                        catalogueRef: 1,
                        number: "46",
                        value: 12.50,
                        condition: 1,
                        unknown: true,
                        nospace: true,
                        active: true
                    }
                ]
            };
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    expect(res.body.stampOwnerships).to.not.be(undefined);
                    expect(res.body.stampOwnerships.length).to.be(0);
                    expect(res.body.catalogueNumbers[0].unknown).to.be(true);
                    expect(res.body.catalogueNumbers[0].nospace).to.be(true);
                    stamp = res.body;
                    stamp.rate = "3-1/2d";
                    stamp.description = "orange-red";
                    stamp.wantList = false;
                    stamp.catalogueNumbers[0].value = 25.5;
                    stamp.catalogueNumbers[0].nospace = false;
                    stamp.stampOwnerships = [];
                    stamp.stampOwnerships.push({
                        albumRef: 2,
                        condition: 2,
                        grade: 1,
                        notes: "this is a note",
                        pricePaid: 0.25,
                        code: "USD"
                    });
                    superagent.put('http://' + hostname + ':' + server_port + '/rest/stamps/' + stamp.id)
                        .send(stamp)
                        .end(function (e, res) {
                            expect(e).to.eql(null);
                            expect(res.status).to.eql(200);
                            expect(res.body.stampOwnerships).to.not.be(undefined);
                            expect(res.body.stampOwnerships.length).to.be(1);
                            expect(res.body.stampOwnerships[0].albumRef).to.be(2);
                            expect(res.body.stampOwnerships[0].condition).to.be(2);
                            expect(res.body.stampOwnerships[0].grade).to.be(1);
                            expect(res.body.stampOwnerships[0].id).to.be.greaterThan(1000);
                            expect(res.body.catalogueNumbers[0].nospace).to.be(false);
                            expect(res.body.wantList).to.be(false);
                            done();
                        });
                });
        });

        it('GET Collection with 200 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps')
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(200);
                    expect(res.body.stamps).to.not.be(undefined);
                    expect(res.body.total).to.be.greaterThan(0);
                    done();
                });
        });

        it('Verify exists checking', function(done) {
            var stamp = {
                countryRef: 1,
                rate: "6d",
                description: "green",
                wantList: true,
                catalogueNumbers: [
                    {
                        catalogueRef: 1,
                        number: "26",
                        value: 57.50,
                        condition: 1,
                        unknown: true,
                        nospace: true,
                        active: true
                    }
                ]
            };
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.be(201);
                    var existsChecks = [{
                        filter: "(((countryRef eq 1) and (catalogueRef eq 1)) and (number eq '26'))",
                        total: 1
                    }, {
                        filter: "(((countryRef eq 9999) and (catalogueRef eq 1)) and (number eq '26'))",
                        total: 0
                    }, {
                        filter: "(((countryRef eq 1) and (catalogueRef eq 9999)) and (number eq '26'))",
                        total: 0
                    }, {
                        filter: "(((countryRef eq 1) and (catalogueRef eq 1)) and (number eq '26-9999'))",
                        total: 0
                    }, {
                        filter: "(((countryRef eq 9999) and (catalogueRef eq 9999)) and (number eq '26-9999'))",
                        total: 0
                    }];
                    var count = 0;
                    var fn = function(exists) {
                        superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps?$filter=' + exists.filter)
                            .end(function(e,res) {
                                expect(e).to.be(null);
                                expect(res.status).to.be(200);
                                count++;
                                expect(res.body.total).to.be(exists.total);
                                if( count === existsChecks.length) {
                                    done();
                                }
                            });
                    };
                    _.each(existsChecks,function(exist) {
                        fn(exist);
                    });
                });
        });
    });

})(describe, it, after, before);