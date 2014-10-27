var superagent = require('superagent');
var expect = require('expect.js');
var session = require('./util/integration-session');
var NamedCollectionVerifications = require('./util/named-collection-verifier');

(function (describe, it, after, before) {
    "use strict";

    describe('REST Services for Preferences', function (done) {

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

})(describe,it,after,before);