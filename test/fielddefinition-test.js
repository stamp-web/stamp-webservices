var expect = require('expect.js')
var country = require("../app/model/country");
var album = require("../app/model/album");
var preference = require("../app/model/preference");

describe('Field definition tests', function (done) {
    describe('Country field definition tests', function () {
        it("Validate with all required specified", function () {
            var c = {
                name: "Australia",
                id: 500
            };
            expect(country.validate(c)).to.be(true);
        });

        it("Validate missing required parameters", function () {
            var c = {
                name: "Australia",
                desc: "other stuff"
            };
            expect(country.validate(c)).to.be(false);
            delete c.name;
            c.id = 250;
            expect(country.validate(c)).to.be(false);
        });

    });
    
    describe('Album field definition tests', function () {
        it("Validate merge of countries", function () {
            var c = { NAME: "test", COUNTRIES: [1,2] };
            var c2 = { NAME: "updated", DESCRIPTION: "descriptions" };
            var m = album.merge(c2, c);
            expect(m.NAME).to.be.eql("updated");
            expect(m.DESCRIPTION).to.be.eql("descriptions");
            expect(m.COUNTRIES).to.be.eql([1,2]);
        });
    });

    describe('Preference field definition tests', function () {
        it("Validate with all required specified", function () {
            var c = {
                name: "imagePath",
                id: 25670,
                category: "stamps",
                value: "some path"
            };
            expect(preference.validate(c)).to.be(true);
        });
    });
});