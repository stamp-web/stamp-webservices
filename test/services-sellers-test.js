import superagent from 'superagent';
import session from './util/integration-session.js';
import NamedCollectionVerifications from './util/named-collection-verifier.js';


describe('REST Services for Sellers', () => {

    let hostname, server_port, connection;

    afterAll(async () => {
        await session.cleanup();
    });

    beforeAll(async () => {
        await session.initialize();
        hostname = session.getHostname();
        server_port = session.getPort();
        connection = session.getConnection();
    });

    it('GET Collection with 200 status', async () => {
        await NamedCollectionVerifications.verifyCollection('sellers');
    });
    
    it('GET by ID with 200 status', async () => {
        await NamedCollectionVerifications.verifySingleItem('sellers', {
            id:          1,
            name:        'APS Indian States',
            description: 'API Circuit'
        });
    });
    
    it('GET by invalid ID with 404 status', async () => {
        await NamedCollectionVerifications.verifyNotFound('sellers');
    });

    it('PUT with invalid non-existing ID', async () => {
        await NamedCollectionVerifications.verifyPutNotFound('sellers', {description: 'some value'});
    });

    it('POST valid creation with 201 status', async () => {
        await NamedCollectionVerifications.verifyPost('sellers', {
            name: 'Iain Kennedy', description: 'British dealer'
        });
    });

    it('DELETE successful', async () => {
        await NamedCollectionVerifications.verifyDelete('sellers', {
            name: 'Seaside Stamp and Coin'
        });
    });

    it('DELETE no existing ID', async () => {
        await NamedCollectionVerifications.verifyDeleteNotFound('sellers');
    });

    it('DELETE clears SELLER_ID of ownership and updates ModifyStamp of stamp and ownership', async () => {
        let seller;
        await NamedCollectionVerifications.verifyPost('sellers', {
            name: 'Test of Delete Seller_ID'
        }, (s) => {
            seller = s;
        });
        
        await new Promise((resolve, reject) => {
            connection.query('INSERT INTO STAMPS (ID,COUNTRY_ID,DENOMINATION) VALUES(80200,1,"1d")', (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        await new Promise((resolve, reject) => {
            connection.query('INSERT INTO OWNERSHIP (ID,SELLER_ID,STAMP_ID) VALUES(80200,' + seller.id + ',80200)', (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
        
        const time = new Date().getTime();
        const resDel = await superagent.del(`http://${hostname}:${server_port}/rest/sellers/${seller.id}`);
        expect(resDel.status).toEqual(204);
        
        const data = await new Promise((resolve, reject) => {
            connection.query('SELECT s.MODIFYSTAMP AS sMod, o.MODIFYSTAMP AS oMod, o.SELLER_ID AS seller_id FROM STAMPS AS s LEFT OUTER JOIN OWNERSHIP AS o ON s.ID=o.STAMP_ID WHERE s.ID=80200', (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        
        expect(new Date(data[0].sMod).getTime() - time).toBeLessThan(500);
        expect(new Date(data[0].oMod).getTime() - time).toBeLessThan(500);
        expect(data[0].seller_id).toBe(null);
    });

});
