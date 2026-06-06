import superagent from 'superagent';
import session from './util/integration-session.js';
import stampUtil from './util/stamp-utilities.js';
import NamedCollectionVerifications from './util/named-collection-verifier.js';

describe('REST Services for Stamps', () => {

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

    it('GET works with no stamps', async () => {
        const res = await superagent.get(`http://${hostname}:${server_port}/rest/stamps`);
        expect(res.status).toEqual(200);
        expect(res.body.total).toEqual(0);
        expect(res.body.stamps).toStrictEqual([]);
    });

    it('POST valid creation with 201 status', async () => {
        const stamp = {
            countryRef: 1,
            rate: "1d",
            description: "red",
            wantList: false,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "23a",
                    value: 0.65,
                    condition: 1,
                    active: true
                }
            ],
            stampOwnerships: [
                {
                    albumRef: 2,
                    condition: 2,
                    grade: 1,
                    notes: "this is a note",
                    pricePaid: 0.25,
                    code: "USD",
                    sellerRef: 1,
                    purchased: "2007-05-15T00:00:00-05:00"
                }
            ]
        };
        const res = await stampUtil.create(stamp);
        const result = res.body;
        expect(result.id).toBeGreaterThan(1000);
        expect(result.rate).toEqual("1d");
        expect(result.description).toEqual("red");
        expect(result.countryRef).toBe(1);
        const catalogueNumbers = res.body.catalogueNumbers;
        expect(catalogueNumbers.length).toBe(1);
        expect(catalogueNumbers[0].id).toBeGreaterThan(1000);
        expect(catalogueNumbers[0].value > 0.64999 && catalogueNumbers[0].value < 0.65001).toBeTruthy();
        expect(catalogueNumbers[0].number).toEqual("23a");
        expect(catalogueNumbers[0].condition).toBe(1);
        expect(catalogueNumbers[0].active).toBe(true);
        const ownership = res.body.stampOwnerships[0];
        expect(ownership.grade).toBe(1);
        expect(ownership.condition).toBe(2);
        expect(ownership.albumRef).toBe(2);
        expect(ownership.notes).toEqual("this is a note");
        expect(ownership.pricePaid > 0.24999 && ownership.pricePaid < 0.25001).toBeTruthy();
        expect(ownership.code).toEqual("USD");
        expect(ownership.sellerRef).toBe(1);
        expect(ownership.purchased.indexOf("2007-05-15")).toBe(0);
    });

    it('POST for descriptions with apostrophes (issue #48)', async () => {
        const description = "blackish opal-green (rotary press printing - 1'5'1)";
        const stamp = {
            countryRef: 1,
            rate: "30pf",
            description: description,
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "172 W OR",
                    value: 2.50,
                    condition: 1,
                    active: true
                }
            ]
        };
        const res = await stampUtil.create(stamp);
        const result = res.body;
        expect(result.id).toBeGreaterThan(1000);
        expect(result.rate).toEqual("30pf");
        expect(result.description).toEqual(description);
        expect(result.countryRef).toBe(1);
        const catalogueNumbers = res.body.catalogueNumbers;
        expect(catalogueNumbers.length).toBe(1);
        expect(catalogueNumbers[0].id).toBeGreaterThan(1000);
        expect(catalogueNumbers[0].value > 2.4999 && catalogueNumbers[0].value < 2.5001).toBeTruthy();
        expect(catalogueNumbers[0].number).toEqual("172 W OR");
        expect(catalogueNumbers[0].condition).toBe(1);
        expect(catalogueNumbers[0].active).toBe(true);
    });

    it('GET collection with multiple conditions in OR with countryRef', async () => {
        let country;
        await NamedCollectionVerifications.verifyPost('countries', {
            name: 'test-multiple-conditions'
        }, (c) => {
            country = c;
        });

        let stamp = {
            countryRef: country.id,
            rate: "1d",
            description: "red",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "or-test-1",
                    value: 0.65,
                    condition: 1,
                    active: true
                }
            ]
        };
        await stampUtil.create(stamp);

        stamp = {
            countryRef:       country.id,
            rate:             "2d",
            description:      "green",
            wantList:         true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "or-test-2",
                    value:        1.25,
                    condition:    2,
                    active:       true
                }
            ]
        };
        await stampUtil.create(stamp);

        const res = await superagent.get(`http://${hostname}:${server_port}/rest/stamps?$filter=(countryRef eq ${country.id} and ((condition eq 1) or (condition eq 4)))`);
        expect(res.status).toEqual(200);
        expect(res.body.total).toEqual(1);
        expect(res.body.stamps).not.toBe(undefined);
    });

    it('GET collection with compound conditions', async () => {
        let country;
        await NamedCollectionVerifications.verifyPost('countries', {
            name: 'test-compound-conditions'
        }, countryObj => {
            country = countryObj;
        });

        let stamp = {
            countryRef: country.id,
            rate: '1d',
            description: 'orange-red',
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: '1d-orange',
                    value: 100.0,
                    condition: 1,
                    active: true
                }
            ]
        };
        await stampUtil.create(stamp);

        stamp = {
            countryRef:       country.id,
            rate:             "2d",
            description:      "green and orange",
            wantList:         true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number:       "2d-green",
                    value:        1.25,
                    condition:    2,
                    active:       true
                }
            ]
        };
        await stampUtil.create(stamp);

        const checkForStamp = async (filter) => {
            const res = await superagent.get(`http://${hostname}:${server_port}/rest/stamps?$filter=${filter}`);
            expect(res.status).toEqual(200);
            expect(res.body.total).toEqual(1);
            expect(res.body.stamps).not.toBe(undefined);
        };

        let filter = `((countryRef eq ${country.id}) and (startswith(rate,'2d') and endswith(description,'orange')))`;
        await checkForStamp(filter);
        filter = `((countryRef eq ${country.id}) and ((contains(rate,'1d')) and (contains(description,'orange'))))`;
        await checkForStamp(filter);
    });

    it('POST with apostrophe is valid creation with 201 status (Issue #36)', async () => {
        const stamp = {
            countryRef: 1,
            rate: "1d'ish",
            description: "Lidth's Jay",
            wantList: false,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "ss'5",
                    value: 25.4,
                    condition: 1,
                    active: true
                }
            ],
            stampOwnerships: [
                {
                    albumRef: 2,
                    condition: 2,
                    grade: 1,
                    notes: "this is a note of happy day of you'll love",
                    pricePaid: 0.25,
                    code: "USD",
                    sellerRef: 1,
                    purchased: "2007-05-15T00:00:00-05:00"
                }
            ]
        };
        const res = await stampUtil.create(stamp);
        const result = res.body;
        expect(result.id).toBeGreaterThan(1000);
        expect(result.rate).toEqual("1d'ish");
        expect(result.description).toEqual("Lidth's Jay");
        const catalogueNumbers = res.body.catalogueNumbers;
        expect(catalogueNumbers.length).toBe(1);
        expect(catalogueNumbers[0].number).toEqual("ss'5");
        const ownership = res.body.stampOwnerships[0];
        expect(ownership.notes).toEqual("this is a note of happy day of you'll love");
    });

    it('POST purchase updates stamps (Issue #61)', async () => {
        let stamp = {
            countryRef:       1,
            rate:             "1d",
            description:      "red",
            wantList:         false,
            catalogueNumbers: [
                {
                    catalogueRef: 2,
                    number:       "54a",
                    value:        100.0,
                    active:       true
                }
            ],
            stampOwnerships:  [
                {
                    albumRef:  2,
                    pricePaid: 25.0,
                    code:      'AUD'
                }
            ]
        };
        const res = await stampUtil.create(stamp);
        const result = res.body;
        const id = result.id;
        const resPurchase = await superagent.post(`http://${hostname}:${server_port}/rest/stamps/purchase`)
            .send({stamps: [id], pricePaid: 50, currencyCode: 'USD'});
        expect(resPurchase.status).toEqual(200);
        const resGet = await superagent.get(`http://${hostname}:${server_port}/rest/stamps/${id}`);
        expect(resGet.body.stampOwnerships[0].pricePaid).toEqual(50.0);
        expect(resGet.body.stampOwnerships[0].code).toEqual('USD');
    });

    it('POST purchase updates stamps unless null catalogue values (Issue #71)', async () => {
        let stamp = {
            countryRef:       1,
            rate:             "1d",
            description:      "red",
            wantList:         false,
            catalogueNumbers: [
                {
                    catalogueRef: 2,
                    number:       "54a",
                    value:        null,
                    active:       true
                }
            ],
            stampOwnerships:  [
                {
                    albumRef:  2,
                    code:      'AUD'
                }
            ]
        };
        const res = await stampUtil.create(stamp);
        const result = res.body;
        const id = result.id;
        const resPurchase = await superagent.post(`http://${hostname}:${server_port}/rest/stamps/purchase`)
            .send({stamps: [id], pricePaid: 50, currencyCode: 'USD'});
        expect(resPurchase.status).toEqual(200);
        const resGet = await superagent.get(`http://${hostname}:${server_port}/rest/stamps/${id}`);
        expect(resGet.body.stampOwnerships[0].pricePaid).toBeNull();
        expect(resGet.body.stampOwnerships[0].code).toEqual('AUD');
    });

    it('POST Create a wantlist stamp with 201 status', async () => {
        const stamp = {
            countryRef: 1,
            rate: "3d",
            description: "yellow-green",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "45",
                    value: 0.75,
                    condition: 1,
                    active: true
                }
            ]
        };
        const res = await stampUtil.create(stamp);
        expect(res.body.stampOwnerships).not.toBe(undefined);
        expect(res.body.stampOwnerships.length).toBe(0);
    });

    it.skip('POST Create a wantlist stamp with polish characters (Issue #72)', async () => {
        const stamp = {
            countryRef: 1,
            rate: "1z\u0142 + 1z\u0142".replace(/[\u0800-\uFFFF]/g, ''),
            description: "purple and black",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "12",
                    value: 2.0,
                    condition: 1,
                    active: true
                }
            ]
        };
        const res = await stampUtil.create(stamp);
        expect(res.status).toEqual(201);
    });


    it('Verify trigger behavior on INSERT/DELETE catalogue numbers', async () => {
        const stamp = {
            countryRef: 1,
            rate: "6d",
            description: "yellow",
            wantList: false,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "45",
                    value: 5.65,
                    condition: 1,
                    active: true
                },
                {
                    catalogueRef: 1,
                    number: "45a",
                    value: 56.23,
                    condition: 0,
                    active: false
                }
            ],
            stampOwnerships: []
        };
        const res = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(res.status).toEqual(201);
        const id = res.body.id;

        const checkCatalogueCount = async (expectedCount) => {
            const data = await new Promise((resolve, reject) => {
                connection.query('SELECT CATALOGUE_COUNT FROM STAMPS WHERE ID=' + id, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });
            expect(data[0].CATALOGUE_COUNT).toBe(expectedCount);
        };

        await checkCatalogueCount(2);

        const resPost = await superagent.post(`http://${hostname}:${server_port}/rest/catalogueNumbers`)
            .send({
                catalogueRef: 1,
                number:       67,
                value:        677,
                active:       false,
                stampRef:     id
            });
        expect(resPost.status).toEqual(201);
        const catID = resPost.body.id;

        await checkCatalogueCount(3);

        const resDel = await superagent.del(`http://${hostname}:${server_port}/rest/catalogueNumbers/${catID}`);
        expect(resDel.status).toEqual(204);

        await checkCatalogueCount(2);
    });

    it('PUT Convert a wantlist to a stamp with 200 status', async () => {
        let stamp = {
            countryRef: 1,
            rate: "3d",
            description: "orange",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "46",
                    value: 12.50,
                    condition: 1,
                    unknown: true,
                    nospace: true,
                    active: true
                }
            ]
        };
        const res = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(res.status).toEqual(201);
        expect(res.body.stampOwnerships).not.toBe(undefined);
        expect(res.body.stampOwnerships.length).toBe(0);
        expect(res.body.catalogueNumbers[0].unknown).toBe(true);
        expect(res.body.catalogueNumbers[0].nospace).toBe(true);
        
        stamp = res.body;
        stamp.rate = "3-1/2d";
        stamp.description = "orange-red";
        stamp.wantList = false;
        stamp.catalogueNumbers[0].value = 25.5;
        stamp.catalogueNumbers[0].nospace = false;
        stamp.stampOwnerships = [];
        stamp.stampOwnerships.push({
            albumRef:  2,
            condition: 2,
            grade:     1,
            notes:     "this is a note",
            pricePaid: 0.25,
            code:      "USD"
        });
        
        const resPut = await superagent.put(`http://${hostname}:${server_port}/rest/stamps/${stamp.id}`)
            .send(stamp);
        expect(resPut.status).toEqual(200);
        expect(resPut.body.stampOwnerships).not.toBe(undefined);
        expect(resPut.body.stampOwnerships.length).toBe(1);
        expect(resPut.body.stampOwnerships[0].albumRef).toBe(2);
        expect(resPut.body.stampOwnerships[0].condition).toBe(2);
        expect(resPut.body.stampOwnerships[0].grade).toBe(1);
        expect(resPut.body.stampOwnerships[0].id).toBeGreaterThan(1000);
        expect(resPut.body.catalogueNumbers[0].nospace).toBe(false);
        expect(resPut.body.wantList).toBe(false);
    });

    it('GET Collection with 200 status', async () => {
        const res = await superagent.get(`http://${hostname}:${server_port}/rest/stamps`);
        expect(res.status).toEqual(200);
        expect(res.body.stamps).not.toBe(undefined);
        expect(res.body.total).toBeGreaterThan(0);
    });

    it('Verify exists checking', async () => {
        const stamp = {
            countryRef: 1,
            rate: "6d",
            description: "green",
            wantList: true,
            catalogueNumbers: [
                {
                    catalogueRef: 1,
                    number: "26",
                    value: 57.50,
                    condition: 1,
                    unknown: true,
                    nospace: true,
                    active: true
                }
            ]
        };
        const res = await superagent.post(`http://${hostname}:${server_port}/rest/stamps`)
            .send(stamp);
        expect(res.status).toBe(201);
        
        const existsChecks = [{
            filter: "(((countryRef eq 1) and (catalogueRef eq 1)) and (number eq '26'))",
            total: 1
        }, {
            filter: "(((countryRef eq 9999) and (catalogueRef eq 1)) and (number eq '26'))",
            total: 0
        }, {
            filter: "(((countryRef eq 1) and (catalogueRef eq 9999)) and (number eq '26'))",
            total: 0
        }, {
            filter: "(((countryRef eq 1) and (catalogueRef eq 1)) and (number eq '26-9999'))",
            total: 0
        }, {
            filter: "(((countryRef eq 9999) and (catalogueRef eq 9999)) and (number eq '26-9999'))",
            total: 0
        }];
        
        for (const exists of existsChecks) {
            const resGet = await superagent.get(`http://${hostname}:${server_port}/rest/stamps?$filter=${exists.filter}`);
            expect(resGet.status).toBe(200);
            expect(resGet.body.total).toBe(exists.total);
        }
    });
});
