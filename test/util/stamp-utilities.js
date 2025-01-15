/* eslint jest/no-standalone-expect: 0 */
const superagent = require('superagent')
const extend = require('node.extend');
const nconf = require('nconf');
nconf.argv().env();

let server_port = 9002;
let hostname = 'localhost';

if (nconf.get("port")) {
    server_port = +nconf.get("port");
}
if (nconf.get("hostname")) {
    hostname = nconf.get("hostname");
}

const StampUtilities = {

    create: (stamp, fn) => {
        const v = (new Date()).getTime() % 1024;
        const s = {
            countryRef: 1,
            rate: "1d",
            description: "red",
            wantList: false,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "" + v,
                    value: 1.25,
                    condition: 1,
                    active: true
                }
            ],
            stampOwnerships: []
        };
        const owner = {
            albumRef: 2,
            condition: 2,
            grade: 1,
            notes: "this is a note",
            pricePaid: 0.25,
            code: "USD",
            sellerRef: 1,
            purchased: "2007-05-15T00:00:00-05:00"
        };
        stamp = extend(true, {}, s, (stamp === null) ? {} : stamp);
        if (stamp.wantList === false && stamp.stampOwnerships.length === 0) {
            stamp.stampOwnerships.push(owner);
        }

        superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
            .send(stamp)
            .end((e, res) => {
                expect(e).toEqual(null);
                expect(res.status).toEqual(201);
                fn(e, res);
            });
        return stamp;
    }
};

module.exports = StampUtilities;