import superagent from 'superagent';
import session from './util/integration-session.js';


describe('Verify health check', () => {

    let hostname, server_port;

    afterAll(done => {
        session.cleanup(() => {
            done();
        });
    });

    beforeAll(done => {
        session.initialize( () => {
            hostname = session.getHostname();
            server_port = session.getPort();
            done();
        });
    });

    it('Verify health end point is reachable', done => {
        superagent.get(`http://${hostname}:${server_port}/health`)
            .end((e, res) => {
                expect(res.status).toEqual(200);
                done()
            });
    });

});
