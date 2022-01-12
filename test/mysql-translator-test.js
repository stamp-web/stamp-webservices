var country = require("../app/model/country");
var catalogueNumber = require("../app/model/catalogue-number");
var ownership = require("../app/model/ownership");
var album = require("../app/model/album");
var preference = require("../app/model/preference");
var translator = require("../app/services/mysql-translator");
var DateUtilities = require('../app/util/date-utilities');
var Constants = require("../app/util/constants");
var ODataParser = require('odata-filter-parser');
var moment = require('moment');

var Predicate = ODataParser.Predicate;
var Operators = ODataParser.Operators;

describe('MySQL Translator tests', () => {

    describe('Generate Update by Key test', () => {
        it("Generate same keys, new values", () => {
           var c = {
               NAME: "Australia-typo",
               ID: 600
           };
           var c_update = {
               NAME: "Australia",
               DESCRIPTION: "This is a description",
               ID: 600
           };
           expect(translator.generateUpdateByFields(country,c_update,c)).toEqual(
               "UPDATE COUNTRIES SET NAME='Australia', DESCRIPTION='This is a description', MODIFYSTAMP=CURDATE() WHERE ID=600"
           );
        });

        it("Nothing different generates update timestamp", () => {
            var c = {
                NAME: "Australia",
                ID: 600
            };
            expect(translator.generateUpdateByFields(country,c,c)).toEqual("UPDATE COUNTRIES SET MODIFYSTAMP=CURDATE() WHERE ID=600");
        });

        it("obj_array does not generate update", () => {
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
            expect(update.indexOf("COUNTRIES")).toBe(-1);
        });
    });

    describe('Generate Insert Statement tests', () => {
        it("Country with full parameters", () => {
            var c = {
                name: "Australia",
                description: "This is my description",
                id: 700
            };
            expect(translator.generateInsertStatement(country, c)).toEqual(
                "INSERT INTO COUNTRIES (NAME,DESCRIPTION,ID,CREATESTAMP) VALUES('Australia','This is my description',700,CURDATE())"
            );
        });
        
        it("Country with create timestamp pre-set", () => {
            var date = moment().subtract(1,'days').toDate();
            var dStr = moment(date).format(Constants.MYSQL_DATEFORMAT);
            var c = {
                name: "Australian States - Queensland",
                id: 150,
                createTimestamp: date
            };
            expect(translator.generateInsertStatement(country, c)).toEqual(
                "INSERT INTO COUNTRIES (NAME,ID,CREATESTAMP) VALUES('Australian States - Queensland',150,'" + dStr + "')"
            );
            
        });

        it("Preference with full parameters", () => {
            var p = {
                id: 675,
                name: "imagePath",
                category: "stamps",
                value: "some image path"
            };
            expect(translator.generateInsertStatement(preference, p)).toEqual(
                "INSERT INTO PREFERENCES (ID,NAME,CATEGORY,VALUE,CREATESTAMP) VALUES(675,'imagePath','stamps','some image path',CURDATE())"
            );
        });

        
    });
    describe("Generate In Clause Value Statements", () => {
        it("Single value", () => {
            var ids = [654];
            expect(translator.generateInValueStatement(ids)).toEqual("(654)");
        });
        it("Multiple values", () => {
            var ids = [4,5,7,12];
            expect(translator.generateInValueStatement(ids)).toEqual("(4,5,7,12)");
        });
        it("No values", () => {
            var ids = [];
            expect(translator.generateInValueStatement(ids)).toEqual("");
        });
    });

    describe('Generate WhereClause statements', () => {
        it("Generate less than clause", () => {
            var output = translator.toWhereClause(new Predicate({subject: 'value', operator: Operators.LESS_THAN, value: 100}), [catalogueNumber]);
            expect(output).toEqual("c.CATALOGUEVALUE<100");
        });
        it("Generate less than equal clause", () => {
            var output = translator.toWhereClause(new Predicate({subject: 'value', operator: Operators.LESS_THAN_EQUAL, value: 50.50}), [catalogueNumber]);
            expect(output).toEqual("c.CATALOGUEVALUE<=50.5");
        });
        it("Generate greater than clause", () => {
            var output = translator.toWhereClause(new Predicate({subject: 'value', operator: Operators.GREATER_THAN, value: 100}), [catalogueNumber]);
            expect(output).toEqual("c.CATALOGUEVALUE>100");
        });
        it("Generate greater than clause with Date", () => {
            var d = new Date();
            var dStr = d.toISOString(); // equivalent to date string passed on URLs
            var output = translator.toWhereClause(new Predicate({subject: 'purchased', operator: Operators.GREATER_THAN, value: 'datetimeoffset\'' + dStr + '\''}), [ownership]);

            var str = new moment(d).format(Constants.MYSQL_DATEFORMAT);
            expect(output).toEqual("o.PURCHASED>'" + str + "'");
        });

        it("Generate greater than clause with Date object", () => {
            var d = new Date();
            var dStr = d.toISOString(); // equivalent to date string passed on URLs
            var output = translator.toWhereClause(new Predicate({subject: 'purchased', operator: Operators.GREATER_THAN, value: d}), [ownership]);

            var str = new moment(d.toISOString()).format(Constants.MYSQL_DATEFORMAT);
            expect(output).toEqual("o.PURCHASED>'" + str + "'");
        });

        it("Generate greater than equal clause", () => {
            var output = translator.toWhereClause(new Predicate({subject: 'value', operator: Operators.GREATER_THAN_EQUAL, value: 50.50}), [catalogueNumber]);
            expect(output).toEqual("c.CATALOGUEVALUE>=50.5");
        });
        it("Generate OR clause with brackets", () => {
            var p = Predicate.concat(Operators.OR, [
                new Predicate({subject: 'condition', value: 1}),
                new Predicate({subject: 'condition', value: 4})
            ]);

            var output = translator.toWhereClause(p, [catalogueNumber]);
            expect(output).toEqual("(c.CAT_CONDITION=1 OR c.CAT_CONDITION=4)");
        });

        it("Generate AND clause", () => {
            var p = Predicate.concat(Operators.AND, [
                new Predicate({subject: 'active', value: 1}),
                new Predicate({subject: 'catalogueRef', value: 23})
            ]);

            var output = translator.toWhereClause(p, [catalogueNumber]);
            expect(output).toEqual("c.ACTIVE=1 AND c.CATALOGUE_REF=23");
        });

        it("Generate AND with OR clause", () => {
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
            expect(output).toEqual(
                "c.ACTIVE=1 AND c.CATALOGUE_REF=23 AND (c.CAT_CONDITION=1 OR (c.CAT_CONDITION=4 OR c.CAT_CONDITION=7))"
            );
        });
    });
});