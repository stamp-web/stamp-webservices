var expect = require('expect.js')
var country = require("../app/model/country");
var album = require("../app/model/album");
var preference = require("../app/model/preference");
var translator = require("../app/services/mysql-translator");
var dateUtils = require("date-utils");
var Constants = require("../app/util/constants");

describe('MySQL Translator tests', function (done) {

    describe('Generate Update by Key test', function() {
        it("Generate same keys, new values", function() {
           var c = {
               NAME: "Australia-typo",
               ID: 600
           };
           var c_update = {
               NAME: "Australia",
               DESCRIPTION: "This is a description",
               ID: 600
           };
           expect(translator.generateUpdateByFields(country,c_update,c)).to.be.eql(
               "UPDATE COUNTRIES SET NAME='Australia', DESCRIPTION='This is a description', MODIFYSTAMP=CURDATE() WHERE ID=600"
           );
        });

        it("Nothing different generates update timestamp", function() {
            var c = {
                NAME: "Australia",
                ID: 600
            };
            expect(translator.generateUpdateByFields(country,c,c)).to.be.eql(
                "UPDATE COUNTRIES SET MODIFYSTAMP=CURDATE() WHERE ID=600"
            );
        });

        it("obj_array does not generate update", function() {
            var a = {
                NAME: "British Europe",
                COUNTRIES: [4,3],
                ID: 25
            };
            var b = {
                NAME: "British Europe",
                COUNTRIES: [2,5,7],
                ID: 25
            };
            var update = translator.generateUpdateByFields(album,b,a);
            expect(update.indexOf("COUNTRIES")).to.be(-1);
        });
    });

    describe('Generate Insert Statement tests', function () {
        it("Country with full parameters", function () {
            var c = {
                name: "Australia",
                description: "This is my description",
                id: 700
            };
            expect(translator.generateInsertStatement(country, c)).to.be.eql(
                "INSERT INTO COUNTRIES (NAME,DESCRIPTION,ID,CREATESTAMP) VALUES('Australia','This is my description',700,CURDATE())"
            );
        });
        
        it("Country with create timestamp pre-set", function () {
            var date = Date.yesterday();
            var date_s = date.toFormat(Constants.MYSQL_DATEFORMAT);
            var c = {
                name: "Australian States - Queensland",
                id: 150,
                createTimestamp: date
            };
            expect(translator.generateInsertStatement(country, c)).to.be.eql(
                "INSERT INTO COUNTRIES (NAME,ID,CREATESTAMP) VALUES('Australian States - Queensland',150,'" + date_s + "')"
);
            
        });

        it("Preference with full parameters", function () {
            var p = {
                id: 675,
                name: "imagePath",
                category: "stamps",
                value: "some image path"
            };
            expect(translator.generateInsertStatement(preference, p)).to.be.eql(
                "INSERT INTO PREFERENCES (ID,NAME,CATEGORY,VALUE,CREATESTAMP) VALUES(675,'imagePath','stamps','some image path',CURDATE())"
            );
        });

        
    });
    describe("Generate In Clause Value Statements", function () {
        it("Single value", function () {
            var ids = [654];
            expect(translator.generateInValueStatement(ids)).to.be.eql("(654)");
        });
        it("Multiple values", function () {
            var ids = [4,5,7,12];
            expect(translator.generateInValueStatement(ids)).to.be.eql("(4,5,7,12)");
        });
        it("No values", function () {
            var ids = [];
            expect(translator.generateInValueStatement(ids)).to.be.eql("");
        });
    });
});