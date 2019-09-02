var superagent = require('superagent');
var expect = require('expect.js');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

(function (describe, it, after, before) {
    "use strict";

    describe('REST Services for Sellers', function () {

        var hostname, server_port, connection;

        after(function (done) {
            session.cleanup(function () {
                done();
            });
        });

        before(function (done) {
            session.initialize(function () {
                hostname = session.getHostname();
                server_port = session.getPort();
                connection = session.getConnection();
                done();
            });
        });

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
            }, undefined, function (seller) {
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

})(describe,it,after,before);