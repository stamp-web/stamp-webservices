import session from './util/integration-session.js';
import NamedCollectionVerifications from './util/named-collection-verifier.js';

describe('REST Services for Preferences', () => {

    afterAll(async () => {
        await session.cleanup();
    });

    beforeAll(async () => {
        await session.initialize();
    });

    it('GET Collection with 200 status', async () => {
        await NamedCollectionVerifications.verifyCollection('preferences', (obj) => {
            expect(obj.category).not.toBe(undefined);
            expect(obj.value).not.toBe(undefined);
        });
    });

    it('GET by ID with 200 status', async () => {
        await NamedCollectionVerifications.verifySingleItem('preferences', {
            id:   1,
            name: 'imagePath'
        }, (obj) => {
            expect(obj.category).toEqual('stamps');
            expect(obj.value).toEqual('http://drake-server.dnsdynamic.com');
        });
    });
    
    it('GET by invalid ID with 404 status', async () => {
        await NamedCollectionVerifications.verifyNotFound('preferences');
    });

    it('PUT with invalid non-existing ID', async () => {
        await NamedCollectionVerifications.verifyPutNotFound('preferences', {value: 'some value'});
    });

    it('POST valid creation with 201 status', async () => {
        await NamedCollectionVerifications.verifyPost('preferences', {
            name: 'somePref', category: 'stamps', value: 'someValue'
        }, (obj) => {
            expect(obj.category).toEqual('stamps');
        });
    });

    it('DELETE successful with no retained state', async () => {
        await NamedCollectionVerifications.verifyDelete('preferences', {
            name: 'prefName', category: 'stamps', value: 'a value'
        });
    });

    it('DELETE no existing ID', async () => {
        await NamedCollectionVerifications.verifyDeleteNotFound('preferences');
    });
});
