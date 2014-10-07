var superagent = require('superagent')
var child_process = require('child_process');
var path = require('path');
var expect = require('expect.js')
var logger = require('../app/util/logger');
var mysql = require('mysql');
var fs = require('fs');

var connectionHelper = require('./util/connection-helper');

var nconf = require('nconf');
nconf.argv().env();

logger.setLevel(logger.INFO);
logger.setTarget("file", __dirname + "/../logs/output.log");

var server_port = 9002;
var hostname = 'localhost';

if (nconf.get("port")) {
    server_port = +nconf.get("port");
}
if (nconf.get("hostname")) {
    hostname = nconf.get("hostname");
}

var RANDOM_ID = (new Date()).getTime() % (2048 * 2048);

var NamedCollectionVerifications = {
    verifyCollection: function (collectionName, done, fn) {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName)
        .end(function (e, res) {
            expect(e).to.eql(null);
            expect(res.status).to.eql(200);
            expect(res.body.total).to.be.above(0);
            expect(res.body[collectionName]).to.not.be(undefined);
            var obj = res.body[collectionName][0];
            if (obj) {
                expect(obj.name).to.not.be(undefined);
                expect(obj.id).to.be.above(0);
                if (fn) {
                    fn(obj);
                }
            } else {
                expect().fail("No data present.");
            }
            done();
        });

    },
    verifySingleItem: function (collectionName, props, done, fn) {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + props.id)
          .end(function (e, res) {
            expect(e).to.eql(null);
            expect(res.status).to.eql(200);
            expect(res.body).to.not.eql(null);
            expect(res.body.name).to.be.eql(props.name);
            expect(res.body.id).to.be.eql(props.id);
            if (fn) {
                fn(res.body);
            }
            done();
        })
    },
    verifyNotFound: function (collectionName, done) {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + RANDOM_ID)
          .end(function (e, res) {
            expect(e).to.eql(null);
            expect(res.status).to.eql(404);
            done();
        })
    },
    verifyPutNotFound: function (collectionName, props, done) {
        superagent.put('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + RANDOM_ID)
            .send(props)
          .end(function (e, res) {
            expect(e).to.eql(null);
            expect(res.status).to.eql(404);
            done();
        })
    },
    verifyPost: function (collectionName, props, done, fn) {
        superagent.post('http://' + hostname + ':' + server_port + '/rest/' + collectionName)
            .send(props)
          .end(function (e, res) {
            expect(e).to.eql(null);
            expect(res.status).to.eql(201);
            var body = res.body;
            expect(body.id).to.not.eql(null);
            expect(body.id).to.be.above(1000);
            expect(body.name).to.eql(props.name);
            expect(body.description).to.eql(props.description);
            if (fn) {
                fn(body);
            }
            done();
        });
    }
}


describe('REST Services tests', function (done) {
    before(function (done) {
        logger.log(logger.INFO, "Reading SQL contents...");
        var contents = fs.readFileSync('test/dbscript/initial-data.sql', { encoding: 'utf-8' }).toString();
        
        var connection = mysql.createConnection({
            host     : 'localhost',
            user     : 'tester',
            password : 'tester',
            database : 'unittest'
        });
        
        var count = 0;
        var totalCount = connectionHelper.loadFromFile(connection, contents, function () {
            count++;
        });
        connection.end();
        var child = child_process.fork(__dirname + "/../app/server", [], {
            cwd: "..",
            env: {
                database: "test",
                port: server_port,
                logger_target: "file",
                logger_file: __dirname + "/../logs/output.log"
            }
        });
        
        child.on("message", function (m) {
            if (m && m === "SERVER_STARTED") {
                logger.log(logger.INFO, "Received message that server is successfully started...");
                var f = function () {
                    setTimeout(function () {
                        if (totalCount && count === totalCount) {
                            done();
                        } else {
                            logger.log(logger.INFO, "Server started but SQL statements are still executing...");
                            f();
                        }
                    }, 150);
                }
                f();
            }
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
                name: 'imagePath',
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
       
    });
    
    describe('Country REST API tests', function (done) {
        
        it('GET Collection with 200 status', function (done) {
            NamedCollectionVerifications.verifyCollection("countries", done);
        });
        
        it('GET by ID with 200 status', function (done) {
            NamedCollectionVerifications.verifySingleItem('countries', {
                id: 2,
                name: 'Canada',
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
            })
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
                
            })
        });
        
        it('POST missing name field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({ description: 'some description' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(400);
                done();
            })
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
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                .send({ name: 'PUT causing conflict' })
                  .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var id = res.body.id;
                    // Now verify it is not found.
                    superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
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
            superagent.del('http://' + hostname + ':' + server_port + '/rest/countries/' + RANDOM_ID)
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(404);
                done();
            })
        });
        
        it('DELETE successful with no retained state', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({ name: 'TEST DELETE' })
            .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var id = res.body.id;
                superagent.del('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                  .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(204);
                    // Now verify it is not found.
                    superagent.get('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                        .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(404);
                        done();
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
                name: 'Australia',
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
            })
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
                
            })
        });
        
        it('POST missing name field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ description: 'some description' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(400);
                done();
            })
        });
        
        it('POST missing stamp collection ref field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ name: 'Some album' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(400);
                done();
            })
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
                    expect(res.status).to.eql(200);
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
            superagent.del('http://' + hostname + ':' + server_port + '/rest/albums/' + RANDOM_ID)
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(404);
                done();
            })
        });
        
        it('DELETE successful with no retained state', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ name: 'TEST DELETE', stampCollectionRef: 1 })
            .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var id = res.body.id;
                superagent.del('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                  .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(204);
                    // Now verify it is not found.
                    superagent.get('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                        .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(404);
                        done();
                    });
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
                name: 'British Commonwealth',
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
            })
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
                
            })
        });
        
        it('POST missing name field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/stampCollections')
            .send({ description: 'some description' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(400);
                done();
            })
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
                    }
                    post("Album-" + count, postCallback);
                    var theInterval;
                    var f = function () {
                        if (count === total) {
                            clearInterval(theInterval);
                            superagent.del('http://' + hostname + ':' + server_port + '/rest/stampCollections/1')
                        .end(function (e, res) {
                                expect(e).to.eql(null);
                                expect(res.status).to.eql(204);
                                done();
                            });
                        }
                    }
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