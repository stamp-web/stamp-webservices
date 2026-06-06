import superagent from 'superagent';
import session from './util/integration-session.js';


describe('Verify health check', () => {

    let hostname, server_port;

    afterAll(async () => {
        await session.cleanup();
    });

    beforeAll(async () => {
        await session.initialize();
        hostname = session.getHostname();
        server_port = session.getPort();
    });

    it('Verify health end point is reachable', async () => {
        const res = await superagent.get(`http://${hostname}:${server_port}/health`);
        expect(res.status).toEqual(200);
    });

});
