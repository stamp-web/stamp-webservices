var superagent = require('superagent')
var expect = require('expect.js')
var extend = require('node.extend');
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

var StampUtilities = {

    create: function (stamp, fn) {
        "use strict";

            var v = (new Date()).getTime() % 1024;
            var s = {
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
                stampOwnerships: [ ]
            };
            var owner =  {
                albumRef: 2,
                condition: 2,
                grade: 1,
                notes: "this is a note",
                pricePaid: 0.25,
                code: "USD",
                sellerRef: 1,
                purchased: "2007-05-15T00:00:00-05:00"
            };
            stamp = extend(true, {}, s, (stamp === null) ? { } : stamp );
            if( stamp.wantList === false ) {
                stamp.stampOwnerships.push(owner);
            }

        superagent.post('http://' + hostname + ':' + server_port + '/rest/stamps')
            .send(stamp)
            .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                fn(e, res);
            });
        return stamp;
    }
};

module.exports = StampUtilities;