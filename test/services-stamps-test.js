var superagent = require('superagent');
var expect = require('expect.js');
var session = require('./util/integration-session');

(function (describe, it, after, before) {
    "use strict";

    describe('REST Services for Stamps', function (done) {

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
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
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
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                .send(stamp)
                .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
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
    });

})(describe, it, after, before);