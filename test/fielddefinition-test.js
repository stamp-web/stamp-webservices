var country = require("../app/model/country");
var album = require("../app/model/album");
var preference = require("../app/model/preference");

describe('Field definition tests', () => {
    describe('Country field definition tests', () => {
        it("Validate with all required specified", () => {
            var c = {
                NAME: "Australia",
                ID: 500
            };
            expect(country.validate(c)).toBe(null);
        });

        it("Validate missing required parameters", () => {
            var c = {
                NAME: "Australia",
                DESCRIPTION: "other stuff"
            };
            var validate = country.validate(c);
            expect(validate).not.toBe(null);
            expect(validate.code).toEqual('REQUIRED_FIELD');
            delete c.NAME;
            c.ID = 250;
            validate = country.validate(c);
            expect(validate).not.toBe(null);
            expect(validate.code).toEqual('REQUIRED_FIELD');
        });

    });
    
    describe('Album field definition tests', () => {
        it("Validate merge of countries", () => {
            var c = { NAME: "test", COUNTRIES: [1,2] };
            var c2 = { NAME: "updated", DESCRIPTION: "descriptions" };
            var m = album.merge(c2, c);
            expect(m.NAME).toEqual("updated");
            expect(m.DESCRIPTION).toEqual("descriptions");
            expect(m.COUNTRIES).toEqual([1,2]);
        });
    });

    describe('Preference field definition tests', () => {
        it("Validate with all required specified", () => {
            var c = {
                NAME: "imagePath",
                ID: 25670,
                CATEGORY: "stamps",
                VALUE: "some path"
            };
            expect(preference.validate(c)).toBe(null);
        });
    });
});