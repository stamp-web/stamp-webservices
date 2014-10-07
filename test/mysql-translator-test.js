var expect = require('expect.js')
var country = require("../app/model/country");
var preference = require("../app/model/preference");
var translator = require("../app/services/mysql-translator");
var dateUtils = require("date-utils");

describe('MySQL Translator tests', function (done) {
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
            var date_s = date.toFormat(translator.MYSQL_DATEFORMAT);
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
});