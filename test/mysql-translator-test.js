var expect = require('expect.js')
var country = require("../app/model/country");
var catalogueNumber = require("../app/model/catalogue-number");
var ownership = require("../app/model/ownership");
var album = require("../app/model/album");
var preference = require("../app/model/preference");
var translator = require("../app/services/mysql-translator");
var dateUtils = require("date-utils");
var DateUtilities = require('../app/util/date-utilities');
var Constants = require("../app/util/constants");
var ODataParser = require('odata-filter-parser');

var Predicate = ODataParser.Predicate;
var Operators = ODataParser.Operators;

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

    describe('Generate WhereClause statements', function () {
        it("Generate less than clause", function() {
            var output = translator.toWhereClause(new Predicate({subject: 'value', operator: Operators.LESS_THAN, value: 100}), [catalogueNumber]);
            expect(output).to.be.eql("c.CATALOGUEVALUE<100");
        });
        it("Generate less than equal clause", function() {
            var output = translator.toWhereClause(new Predicate({subject: 'value', operator: Operators.LESS_THAN_EQUAL, value: 50.50}), [catalogueNumber]);
            expect(output).to.be.eql("c.CATALOGUEVALUE<=50.5");
        });
        it("Generate greater than clause", function() {
            var output = translator.toWhereClause(new Predicate({subject: 'value', operator: Operators.GREATER_THAN, value: 100}), [catalogueNumber]);
            expect(output).to.be.eql("c.CATALOGUEVALUE>100");
        });
        it("Generate greater than clause with Date", function() {
            var d = new Date();
            var dStr = d.toISOString(); // equivalent to date string passed on URLs
            var output = translator.toWhereClause(new Predicate({subject: 'purchased', operator: Operators.GREATER_THAN, value: 'datetimeoffset\'' + dStr + '\''}), [ownership]);

            // output format is  YYYY-MM-DD HH:MM:SS
            var pad = function(val,max) {
                var t = val%max;
                if( t < 10 ) {
                    t = 0 + '' + t;
                }
                return t;
            };


            var hours = pad(d.getHours(),12);
            if(d.isDST() ) {
                hours -= 1;
            }

            var dbStr = d.getFullYear() + '-' + pad((d.getMonth()+1),12) + '-' + pad(d.getDate(),31) + ' ' + pad(hours,12) +':'+ pad(d.getMinutes(),60)+':'+ pad(d.getSeconds(),60);
            expect(output).to.be.eql("o.PURCHASED>'" + dbStr + "'");
        });
        it("Generate greater than equal clause", function() {
            var output = translator.toWhereClause(new Predicate({subject: 'value', operator: Operators.GREATER_THAN_EQUAL, value: 50.50}), [catalogueNumber]);
            expect(output).to.be.eql("c.CATALOGUEVALUE>=50.5");
        });
        it("Generate OR clause with brackets", function () {
            var p = Predicate.concat(Operators.OR, [
                new Predicate({subject: 'condition', value: 1}),
                new Predicate({subject: 'condition', value: 4})
            ]);

            var output = translator.toWhereClause(p, [catalogueNumber]);
            expect(output).to.be.eql("(c.CAT_CONDITION=1 OR c.CAT_CONDITION=4)");
        });

        it("Generate AND clause", function () {
            var p = Predicate.concat(Operators.AND, [
                new Predicate({subject: 'active', value: 1}),
                new Predicate({subject: 'catalogueRef', value: 23})
            ]);

            var output = translator.toWhereClause(p, [catalogueNumber]);
            expect(output).to.be.eql("c.ACTIVE=1 AND c.CATALOGUE_REF=23");
        });

        it("Generate AND with OR clause", function () {
            var p = Predicate.concat(Operators.AND, [
                new Predicate({subject: 'active', value: 1}),
                new Predicate({subject: 'catalogueRef', value: 23}),
                Predicate.concat(Operators.OR, [
                    new Predicate({subject: 'condition', value: 1}),
                    new Predicate({subject: 'condition', value: 4}),
                    new Predicate({subject: 'condition', value: 7})
                ])

            ]);

            var output = translator.toWhereClause(p, [catalogueNumber]);
            expect(output).to.be.eql("c.ACTIVE=1 AND c.CATALOGUE_REF=23 AND (c.CAT_CONDITION=1 OR (c.CAT_CONDITION=4 OR c.CAT_CONDITION=7))");
        });
    });
});