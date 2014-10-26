var superagent = require('superagent');
var child_process = require('child_process');
var path = require('path');
var expect = require('expect.js');
var Logger = require('../app/util/logger');
var mysql = require('mysql');
var fs = require('fs');
var _ = require('../lib/underscore');

var connectionHelper = require('./util/connection-helper');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

var nconf = require('nconf');
nconf.argv().env().file(__dirname + '/../config/application.json');

var logger = Logger.getLogger("server");
logger.setLevel(Logger.INFO);
logger.setTarget("file", __dirname + "/../logs/output.log");

var server_port = 9002;
var hostname = 'localhost';

if (nconf.get("port")) {
    server_port = +nconf.get("port");
}
if (nconf.get("hostname")) {
    hostname = nconf.get("hostname");
}

var database = (nconf.get("test_database") ? nconf.get("test_database") : "test");

var sql_level = 'warn';
if (nconf.get("sql_level")) {
    sql_level = nconf.get("sql_level");
}


(function (describe, it, after, before) {
    "use strict";

    describe('REST Services tests', function (done) {
        var connection;

        after(function (done) {
            connection.end();
            done();
        });

        before(function (done) {
            logger.log(Logger.INFO, "Reading SQL contents...");
            var pro = process.cwd();
            var file = ((process.cwd().indexOf('\\test') > 0) ? '../' : '') + 'test/dbscript/initial-data.sql';
            var contents = fs.readFileSync(file, { encoding: 'utf-8' }).toString();

            var dbConfigs = nconf.get("databases");
            var dbConfig = dbConfigs[database];

            connection = mysql.createConnection({
                host: dbConfig.host,
                user: dbConfig.user,
                password: dbConfig.password,
                database: dbConfig.schema
            });

            var count = 0;
            var totalCount = connectionHelper.loadFromFile(connection, contents, function () {
                count++;
            });

            var child = child_process.fork(__dirname + "/../app/server/server", [], {
                cwd: "..",
                env: {
                    database: database,
                    basePath: "/",
                    port: server_port,
                    sql_level: sql_level,
                    logger_target: "file",
                    logger_file: __dirname + "/../logs/output.log"
                }
            });

            child.on("message", function (m) {
                if (m && m === "SERVER_STARTED") {
                    logger.log(Logger.INFO, "Received message that server is successfully started...");
                    var f = function () {
                        setTimeout(function () {
                            if (totalCount && count === totalCount) {
                                done();
                            } else {
                                logger.log(Logger.INFO, "Server started but SQL statements are still executing...");
                                f();
                            }
                        }, 150);
                    };
                    f();
                }
            });

        });

        describe('Catalogue REST API tests', function (done) {
            it('GET Collection with 200 status', function (done) {
                NamedCollectionVerifications.verifyCollection('catalogues', done, function (obj) {
                    expect(obj.issue).to.not.be(null);
                    expect(obj.type).to.not.be(null);
                });
            });
            it('GET by ID with 200 status', function (done) {
                NamedCollectionVerifications.verifySingleItem('catalogues', {
                    id: 1,
                    name: 'Stamps of the world',
                    issue: 2014,
                    type: 0
                }, done, function (obj) {
                    expect(obj.issue).to.be.eql(2014);
                    expect(obj.type).to.be.eql(0);
                });
            });
            it('GET by invalid ID with 404 status', function (done) {
                NamedCollectionVerifications.verifyNotFound('catalogues', done);
            });

            it('PUT with invalid non-existing ID', function (done) {
                NamedCollectionVerifications.verifyPutNotFound('catalogues', { description: 'some value' }, done);
            });

            it('POST valid creation with 201 status', function (done) {
                NamedCollectionVerifications.verifyPost('catalogues', {
                    name: 'Scott Postage Specialized', issue: 2012, type: 1, code: 'USD', description: 'Detailed specialized'
                }, done, function (obj) {
                    expect(obj.issue).to.be.eql(2012);
                    expect(obj.type).to.be.eql(1);
                    expect(obj.code).to.be.eql('USD');
                });
            });

            it('DELETE successful with no retained state', function (done) {
                NamedCollectionVerifications.verifyDelete('catalogues', {
                    name: 'Deleting Catalogue', issue: 2014, type: 2, currency: 'CAD'
                }, done);
            });

            it('DELETE vetoed for orphaned stamps', function (done) {
                NamedCollectionVerifications.verifyPost('catalogues', {
                    name: 'Unable to delete orphans', issue: 2014, type: 1
                }, null, function (obj) {
                    var id = obj.id;
                    var stamp = {
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
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                        .send(stamp)
                        .end(function (e, res) {
                            expect(res.status).to.be(201);
                            superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogues/' + id)
                                .end(function (e, res) {
                                    expect(res.status).to.be(409);
                                    done();
                                });
                        });
                });
            });

            it('DELETE ok for secondary catalogue numbers', function (done) {
                NamedCollectionVerifications.verifyPost('catalogues', {
                    name: 'ok to delete secondary CNs', issue: 2012, type: 2
                }, null, function (obj) {
                    var id = obj.id;
                    var stamp = {
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
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                        .send(stamp)
                        .end(function (e, res) {
                            expect(res.status).to.be(201);
                            superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogues/' + id)
                                .end(function (e, res) {
                                    expect(res.status).to.be(204);
                                    done();
                                });
                        });
                });
            });

            it('DELETE no existing ID', function (done) {
                NamedCollectionVerifications.verifyDeleteNotFound('catalogues', done);
            });

        });

        describe('Preference REST API tests', function (done) {
            it('GET Collection with 200 status', function (done) {
                NamedCollectionVerifications.verifyCollection('preferences', done, function (obj) {
                    expect(obj.category).to.not.be(undefined);
                    expect(obj.value).to.not.be(undefined);
                });
            });
            it('GET by ID with 200 status', function (done) {
                NamedCollectionVerifications.verifySingleItem('preferences', {
                    id: 1,
                    name: 'imagePath'
                }, done, function (obj) {
                    expect(obj.category).to.be.eql('stamps');
                    expect(obj.value).to.be.eql('http://drake-server.dnsdynamic.com');
                });
            });
            it('GET by invalid ID with 404 status', function (done) {
                NamedCollectionVerifications.verifyNotFound('preferences', done);
            });

            it('PUT with invalid non-existing ID', function (done) {
                NamedCollectionVerifications.verifyPutNotFound('preferences', { value: 'some value' }, done);
            });

            it('POST valid creation with 201 status', function (done) {
                NamedCollectionVerifications.verifyPost('preferences', {
                    name: 'somePref', category: 'stamps', value: 'someValue'
                }, done, function (obj) {
                    expect(obj.category).to.be.eql('stamps');
                });
            });

            it('DELETE successful with no retained state', function (done) {
                NamedCollectionVerifications.verifyDelete('preferences', {
                    name: 'prefName', category: 'stamps', value: 'a value'
                }, done);
            });

            it('DELETE no existing ID', function (done) {
                NamedCollectionVerifications.verifyDeleteNotFound('preferences', done);
            });

        });


        describe('Seller REST API tests', function (done) {
            it('GET Collection with 200 status', function (done) {
                NamedCollectionVerifications.verifyCollection('sellers', done);
            });
            it('GET by ID with 200 status', function (done) {
                NamedCollectionVerifications.verifySingleItem('sellers', {
                    id: 1,
                    name: 'APS Indian States',
                    description: 'API Circuit'
                }, done);
            });
            it('GET by invalid ID with 404 status', function (done) {
                NamedCollectionVerifications.verifyNotFound('sellers', done);
            });

            it('PUT with invalid non-existing ID', function (done) {
                NamedCollectionVerifications.verifyPutNotFound('sellers', { description: 'some value' }, done);
            });

            it('POST valid creation with 201 status', function (done) {
                NamedCollectionVerifications.verifyPost('sellers', {
                    name: 'Iain Kennedy', description: 'British dealer'
                }, done);
            });

            it('DELETE successful', function (done) {
                NamedCollectionVerifications.verifyDelete('sellers', {
                    name: 'Seaside Stamp and Coin'
                }, done);
            });

            it('DELETE no existing ID', function (done) {
                NamedCollectionVerifications.verifyDeleteNotFound('sellers', done);
            });

            it('DELETE clears SELLER_ID of ownership and updates ModifyStamp of stamp and ownership', function (done) {
                NamedCollectionVerifications.verifyPost('sellers', {
                    name: 'Test of Delete Seller_ID'
                }, null, function (seller) {
                    // seller is now created and available for evaluation
                    connection.query('INSERT INTO STAMPS (ID,COUNTRY_ID,DENOMINATION) VALUES(80200,1,"1d")', function (err, data) {
                        if (err) {
                            expect().fail("could not save stamp", err);
                        }
                        connection.query('INSERT INTO OWNERSHIP (ID,SELLER_ID,STAMP_ID) VALUES(80200,' + seller.id + ',80200)', function (err, data) {
                            if (err) {
                                expect().fail("could not save ownership", err);
                            }
                            var time = new Date().getTime();
                            superagent.del('http://' + hostname + ':' + server_port + '/rest/sellers/' + seller.id)
                                .end(function (e, res) {
                                    expect(e).to.eql(null);
                                    expect(res.status).to.eql(204);
                                    connection.query('SELECT s.MODIFYSTAMP AS sMod, o.MODIFYSTAMP AS oMod, o.SELLER_ID AS seller_id FROM STAMPS AS s LEFT OUTER JOIN OWNERSHIP AS o ON s.ID=o.STAMP_ID WHERE s.ID=80200', function (err, data) {
                                        expect(err).to.be.eql(null);
                                        expect(new Date(data[0].sMod).getTime() - time).to.be.lessThan(500);
                                        expect(new Date(data[0].oMod).getTime() - time).to.be.lessThan(500);
                                        expect(data[0].seller_id).to.be(null);
                                        done();
                                    });
                                });
                        });
                    });
                });

            });

        });

        describe('Country REST API tests', function (done) {

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

        describe('Album REST API tests', function (done) {

            it('GET Collection with 200 status', function (done) {
                NamedCollectionVerifications.verifyCollection('albums', done, function (obj) {
                    expect(obj.stampCollectionRef).to.be.greaterThan(0);
                });
            });

            it('GET by ID with 200 status', function (done) {
                NamedCollectionVerifications.verifySingleItem('albums', {
                    id: 1,
                    name: 'Australia'
                }, done, function (obj) {
                    expect(obj.stampCollectionRef).to.be.eql(1);
                });
            });

            it('GET collection with Name query with 200 status', function (done) {
                superagent.get('http://' + hostname + ':' + server_port + '/rest/albums?$filter=(name eq \'Australian States\')')
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(200);
                        expect(res.body.total).to.be.eql(1);
                        expect(res.body.albums).to.not.be(undefined);
                        var album = res.body.albums[0];
                        expect(album.name).to.be.eql("Australian States");
                        expect(album.id).to.be.eql(2);
                        done();
                    });
            });

            it('GET by invalid ID with 404 status', function (done) {
                NamedCollectionVerifications.verifyNotFound('albums', done);
            });

            it('POST valid creation with 201 status', function (done) {
                NamedCollectionVerifications.verifyPost('albums', {
                    name: 'British Europe', stampCollectionRef: 1, description: 'European countries'
                }, done, function (obj) {
                    expect(obj.stampCollectionRef).to.be.eql(1);
                });
            });

            it('POST duplicate creation with 409 status', function (done) {
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                    .send({ name: 'German States', stampCollectionRef: 1 })
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        var body = res.body;
                        delete body.id;
                        superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                            .send(body).end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(409);
                                done();
                            });
                    });
            });

            it('POST missing name field with 400 status', function (done) {
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                    .send({ description: 'some description' })
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(400);
                        done();
                    });
            });

            it('POST missing stamp collection ref field with 400 status', function (done) {
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                    .send({ name: 'Some album' })
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(400);
                        done();
                    });
            });

            it('PUT successfully with 200 status', function (done) {
                var name = 'POST album';
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                    .send({ name: name, stampCollectionRef: 1, countries: [1] })
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        var id = res.body.id;
                        superagent.put('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                            .send({ name: 'PUT album', description: 'Description on update', countries: [2] })
                            .end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.be(200);
                                var body = res.body;
                                expect(body.name).to.eql('PUT album');
                                expect(body.description).to.eql('Description on update');
                                expect(body.countries).to.not.eql(null);
                                expect(body.countries.length).to.eql(1);
                                expect(body.countries[0]).to.eql(2);
                                done();
                            });
                    });
            });

            it('PUT with invalid non-existing ID', function (done) {
                NamedCollectionVerifications.verifyPutNotFound('albums', { description: 'some description' }, done);
            });

            it('PUT causing a conflict', function (done) {
                var conflict_name = 'PUT with conflict (orignial)';
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                    .send({ name: conflict_name, stampCollectionRef: 1 })
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                            .send({ name: 'PUT causing conflict', stampCollectionRef: 1 })
                            .end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(201);
                                var id = res.body.id;
                                // Now verify it is not found.
                                superagent.put('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                                    .send({ name: conflict_name })
                                    .end(function (e, res) {
                                        expect(e).to.eql(null);
                                        expect(res.status).to.eql(409);
                                        done();
                                    });
                            });
                    });
            });

            it('DELETE no existing ID', function (done) {
                NamedCollectionVerifications.verifyDeleteNotFound('albums', done);
            });

            it('DELETE successful with cascade to ALBUMS_COUNTRIES', function (done) {
                NamedCollectionVerifications.verifyDelete('albums', {
                    name: 'TEST DELETE', stampCollectionRef: 1, countries: [1]
                }, done, function (done) {
                    superagent.get('http://' + hostname + ':' + server_port + '/rest/countries/1').end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(200);
                        expect(res.body.id).to.be.eql(1);
                        done();
                    });
                });
            });

            it('DELETE removes Ownership but retains Stamp with updated ModifyStamp', function(done) {
                NamedCollectionVerifications.verifyPost('albums', {
                    name: 'An Album to behold', stampCollectionRef: 1, description: 'European countries'
                }, null, function (obj) {
                    var albumID = obj.id;
                    var stamp = {
                        countryRef: 1,
                        rate: "1d",
                        description: "reddish brown",
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
                                albumRef: albumID
                            }
                        ]
                    };
                    superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                        .send(stamp)
                        .end(function (e, res) {
                            expect(e).to.eql(null);
                            expect(res.status).to.eql(201);
                            var stampId = res.body.id;
                            superagent.del('http://' + hostname + ':' + server_port + '/rest/albums/' + albumID)
                                .end(function(e,res) {
                                    expect(e).to.eql(null);
                                    expect(res.status).to.eql(204);
                                    superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps/' + stampId)
                                        .end(function(e,res) {
                                        expect(e).to.eql(null);
                                        expect(res.body.stampOwnerships.length).to.be(0);
                                        done();
                                    });
                                });
                        });
                });

            });

        });


        describe('Stamp REST API tests', function (done) {
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

        describe('CatalogueNumber REST API tests', function (done) {
            it('Make active changes successfully', function (done) {
                var stamp = {
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
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                    .send(stamp)
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        var catalogueNumbers = res.body.catalogueNumbers;
                        var activate = _.findWhere(catalogueNumbers, {active: false});
                        expect(activate).to.not.be(undefined);
                        superagent.post('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + activate.id + '/makeActive')
                            .end(function (e, res) {
                                catalogueNumbers = res.body.catalogueNumbers;
                                expect(_.findWhere(catalogueNumbers, {active: true}).id).to.be.eql(activate.id);
                                expect(_.where(catalogueNumbers, {active: true}).length).to.be(1);
                                done();
                            });


                    });
            });

            it('Make active already active', function (done) {
                var stamp = {
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
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                    .send(stamp)
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        var catalogueNumbers = res.body.catalogueNumbers;
                        var activate = _.findWhere(catalogueNumbers, {active: true});
                        expect(activate).to.not.be(undefined);
                        superagent.post('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + activate.id + '/makeActive')
                            .end(function (e, res) {
                                expect(res.statusCode).to.be(200);
                                catalogueNumbers = res.body.catalogueNumbers;
                                expect(_.findWhere(catalogueNumbers, {active: true}).id).to.be.eql(activate.id);
                                expect(_.where(catalogueNumbers, {active: true}).length).to.be(1);
                                done();
                            });


                    });
            });

            it('DELETE no existing ID', function (done) {
                superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + 800020)
                    .end(function (e, res) {
                        expect(res.statusCode).to.be(404);
                        done();
                    });
            });
            it('DELETE catalogue number directly', function (done) {
                var stamp = {
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
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
                    .send(stamp)
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        var catalogueNumbers = res.body.catalogueNumbers;
                        var nonActive = _.findWhere(catalogueNumbers, {active: false});
                        var stampId = res.body.id;
                        expect(nonActive).to.not.be(undefined);
                        superagent.del('http://' + hostname + ':' + server_port + '/rest/catalogueNumbers/' + nonActive.id)
                            .end(function (e, res) {
                                expect(res.statusCode).to.be(204);
                                superagent.get('http://' + hostname + ':' + server_port + '/rest/stamps/' + stampId)
                                    .end(function (e, res) {
                                        expect(res.body.catalogueNumbers.length).to.be(1);
                                    });
                                done();
                            });
                    });
            });
        });

        describe('Stamp Collection REST API tests', function (done) {

            it('GET Collection with 200 status', function (done) {
                NamedCollectionVerifications.verifyCollection('stampCollections', done);
            });

            it('GET by ID with 200 status', function (done) {
                NamedCollectionVerifications.verifySingleItem('stampCollections', {
                    id: 1,
                    name: 'British Commonwealth'
                }, done);
            });

            it('GET collection with Name query with 200 status', function (done) {
                superagent.get('http://' + hostname + ':' + server_port + '/rest/stampCollections?$filter=(name eq \'British Commonwealth\')')
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(200);
                        expect(res.body.total).to.be.eql(1);
                        expect(res.body.stampCollections).to.not.be(undefined);
                        var collection = res.body.stampCollections[0];
                        expect(collection.name).to.be.eql("British Commonwealth");
                        expect(collection.id).to.be.eql(1);
                        done();
                    });
            });

            it('GET by invalid ID with 404 status', function (done) {
                NamedCollectionVerifications.verifyNotFound('stampCollections', done);
            });


            it('POST valid creation with 201 status', function (done) {
                NamedCollectionVerifications.verifyPost('stampCollections', {
                    name: 'The World Collection', description: 'Stamps of the world'
                }, done);
            });

            it('POST duplicate creation with 409 status', function (done) {
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
                    .send({ name: 'German States' })
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        var body = res.body;
                        delete body.id;
                        superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
                            .send(body).end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(409);
                                done();
                            });
                    });
            });

            it('POST missing name field with 400 status', function (done) {
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
                    .send({ description: 'some description' })
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(400);
                        done();
                    });
            });

            it('PUT successfully with 200 status', function (done) {
                var name = 'POST album';
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
                    .send({ name: name })
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        var id = res.body.id;
                        superagent.put('http://' + hostname + ':' + server_port + '/rest/stampCollections/' + id)
                            .send({ name: 'PUT collection', description: 'Description on update' })
                            .end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(200);
                                expect(res.body.name).to.eql('PUT collection');
                                expect(res.body.description).to.eql('Description on update');
                                done();
                            });
                    });
            });

            it('PUT with invalid non-existing ID', function (done) {
                NamedCollectionVerifications.verifyPutNotFound('stampCollections', { value: 'some description' }, done);
            });

            it('PUT causing a conflict', function (done) {
                var conflict_name = 'PUT with conflict (orignial)';
                superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
                    .send({ name: conflict_name })
                    .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(201);
                        superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
                            .send({ name: 'PUT causing conflict' })
                            .end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(201);
                                var id = res.body.id;
                                superagent.put('http://' + hostname + ':' + server_port + '/rest/stampCollections/' + id)
                                    .send({ name: conflict_name })
                                    .end(function (e, res) {
                                        expect(e).to.eql(null);
                                        expect(res.status).to.eql(409);
                                        done();
                                    });
                            });
                    });
            });

            it('DELETE no existing ID', function (done) {
                NamedCollectionVerifications.verifyDeleteNotFound('stampCollections', done);
            });

            it('DELETE successful removes albums and countries', function (done) {
                var count = 0;
                var total = 10;
                var id = -1;

                superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
                    .send({ name: "DeletingStampCollection" })
                    .end(function (e, res) {
                        id = res.body.id;
                        if (id > 0) {
                            var post = function (name, callback) {
                                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                                    .send({ name: name, stampCollectionRef: id })
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
                                            expect(e).to.eql(null);
                                            expect(res.status).to.eql(204);
                                            // should be a LIKE filter but that is not supported yet
                                            superagent.get('http://' + hostname + ':' + server_port + '/rest/albums?$filter=(name eq \'Album-5\')')
                                                .end(function (e, res) {
                                                    expect(res.body.total).to.eql(0);
                                                    done();
                                                });
                                        });
                                }
                            };
                            theInterval = setInterval(f, 50);
                        } else {
                            expect().fail("No id is available.");
                        }
                    });
            });

            it.skip('DELETE successful removes all associated stamps', function (done) {
            });

        });

    });

})(describe, it, after, before);

