var superagent = require('superagent')
var expect = require('expect.js')

var nconf = require('nconf');
nconf.argv().env();

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
            if (props.description) {
                expect(res.body.description).to.be.eql(props.description);   
            }
            expect(res.body.createTimestamp).to.be(undefined);
            expect(res.body.modifyTimestamp).to.be(undefined);
            if (fn) {
                fn(res.body);
            }
            done();
        })
    },
    verifyNotFound: function (collectionName, done) {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + RANDOM_ID)
          .end(function (e, res) {
            expect(e).to.be(null);
            expect(res.status).to.be(404);
            done();
        });
    },
    verifyPutNotFound: function (collectionName, props, done) {
        superagent.put('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + RANDOM_ID)
            .send(props)
          .end(function (e, res) {
            expect(e).to.be(null);
            expect(res.status).to.be(404);
            done();
        });
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
            if (props.description) {
                expect(body.description).to.eql(props.description);
            }
            if (fn) {
                fn(body);
            }
            if (done !== null) {
                done();
            }
        });
    },
    verifyDeleteNotFound: function (collectionName, done) {
        superagent.del('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + RANDOM_ID)
          .end(function (e, res) {
            expect(e).to.eql(null);
            expect(res.status).to.eql(404);
            done();
        })
    },
    
    verifyDelete: function (collectionName, props, done, fn) {
        "use strict";
        superagent.post('http://' + hostname + ':' + server_port + '/rest/' + collectionName)
            .send(props)
            .end(function (e, res) {
            expect(e).to.eql(null);
            expect(res.status).to.eql(201);
            var id = res.body.id;
                superagent.del('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + id)
                  .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(204);
                // Now verify it is not found.
                superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + id)
                      .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(404);
                    if (fn) {
                        fn(done);
                    } else {
                        done();
                    }
                });
            });
        });
    }
}

module.exports = NamedCollectionVerifications;