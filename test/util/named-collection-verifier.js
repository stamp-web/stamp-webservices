var superagent = require('superagent')

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

var randomId = () => {
  return Math.floor(Math.random() * 100000);
};


var NamedCollectionVerifications = {
    verifyCollection: function (collectionName, done, fn) {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName)
        .end(function (e, res) {
            expect(e).toEqual(null);
            expect(res.status).toEqual(200);
            expect(res.body.total).toBeGreaterThan(0);
            expect(res.body[collectionName]).not.toBe(undefined);
            var obj = res.body[collectionName][0];
            if (obj) {
                expect(obj.name).not.toBe(undefined);
                expect(obj.id).toBeGreaterThan(0);
                if (fn) {
                    fn(obj);
                }
            } else {
                throw Error("No data present.");
            }
            if (done) {
                done();
            }
        });
    },
    

    verifySingleItem: function (collectionName, props, done, fn) {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + props.id)
          .end(function (e, res) {
            expect(e).toEqual(null);
            expect(res.status).toEqual(200);
            expect(res.body).not.toEqual(null);
            expect(res.body.name).toEqual(props.name);
            expect(res.body.id).toEqual(props.id);
            if (props.description) {
                expect(res.body.description).toEqual(props.description);   
            }
            expect(res.body.createTimestamp).toBe(undefined);
            expect(res.body.modifyTimestamp).toBe(undefined);
            if (fn) {
                fn(res.body);
            }
            if (done) {
                done();
            }
        });
    },
    verifyNotFound: function (collectionName, done) {
        superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + randomId())
          .end(function (e, res) {
            expect(res.status).toBe(404);
            done();
        });
    },
    verifyPutNotFound: function (collectionName, props, done) {
        superagent.put('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + randomId())
            .send(props)
          .end(function (e, res) {
            expect(e).not.toBe(null);
            expect(res.status).toBe(404);
            done();
        });
    },
    verifyPost: function (collectionName, props, done, fn) {
        superagent.post('http://' + hostname + ':' + server_port + '/rest/' + collectionName)
            .send(props)
          .end(function (e, res) {
            expect(e).toEqual(null);
            expect(res.status).toEqual(201);
            var body = res.body;
            expect(body.id).not.toEqual(null);
            expect(body.id).toBeGreaterThan(1000);
            expect(body.name).toEqual(props.name);
            if (props.description) {
                expect(body.description).toEqual(props.description);
            }
            if (fn) {
                fn(body);
            }
            if (done) {
                done();
            }
        });
    },
    verifyDeleteNotFound: function (collectionName, done) {
        superagent.del('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + randomId())
          .end((msg, res) => {
            expect(msg).not.toEqual(null);
            expect(res.status).toEqual(404);
            done();
        })
    },
    
    verifyDelete: function (collectionName, props, done, fn) {
        "use strict";
        superagent.post('http://' + hostname + ':' + server_port + '/rest/' + collectionName)
            .send(props)
            .end(function (e, res) {
            expect(e).toEqual(null);
            expect(res.status).toEqual(201);
            var id = res.body.id;
                superagent.del('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + id)
                  .end(function (e, res) {
                expect(e).toEqual(null);
                expect(res.status).toEqual(204);
                // Now verify it is not found.
                superagent.get('http://' + hostname + ':' + server_port + '/rest/' + collectionName + '/' + id)
                      .end(function (e, res) {
                    expect(e).not.toEqual(null);
                    expect(res.status).toEqual(404);
                    if (fn) {
                        fn(done);
                    } else if (done) {
                        done();
                    }
                });
            });
        });
    }
}

module.exports = NamedCollectionVerifications;