const session = require('./util/integration-session');
const NamedCollectionVerifications = require('./util/named-collection-verifier');

describe('REST Services for Preferences', () => {

    afterAll(done => {
        session.cleanup(function () {
            done();
        });
    });

    beforeAll(done => {
        session.initialize( () => {
            done();
        });
    });

    it('GET Collection with 200 status', done => {
        NamedCollectionVerifications.verifyCollection('preferences', undefined, function (obj) {
            expect(obj.category).not.toBe(undefined);
            expect(obj.value).not.toBe(undefined);
            done();
        });
    });

    it('GET by ID with 200 status', done => {
        NamedCollectionVerifications.verifySingleItem('preferences', {
            id:   1,
            name: 'imagePath'
        }, undefined, function (obj) {
            expect(obj.category).toEqual('stamps');
            expect(obj.value).toEqual('http://drake-server.dnsdynamic.com');
            done();
        });
    });
    it('GET by invalid ID with 404 status', done => {
        NamedCollectionVerifications.verifyNotFound('preferences', done);
    });

    it('PUT with invalid non-existing ID', done => {
        NamedCollectionVerifications.verifyPutNotFound('preferences', {value: 'some value'}, done);
    });

    it('POST valid creation with 201 status', done => {
        NamedCollectionVerifications.verifyPost('preferences', {
            name: 'somePref', category: 'stamps', value: 'someValue'
        }, undefined, function (obj) {
            expect(obj.category).toEqual('stamps');
            done();
        });
    });

    it('DELETE successful with no retained state', done => {
        NamedCollectionVerifications.verifyDelete('preferences', {
            name: 'prefName', category: 'stamps', value: 'a value'
        }, done);
    });

    it('DELETE no existing ID', done => {
        NamedCollectionVerifications.verifyDeleteNotFound('preferences', done);
    });
});
