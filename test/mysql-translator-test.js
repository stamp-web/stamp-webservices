const country = require("../app/model/country");
const catalogueNumber = require("../app/model/catalogue-number");
const ownership = require("../app/model/ownership");
const album = require("../app/model/album");
const preference = require("../app/model/preference");
const translator = require("../app/services/mysql-translator");
const Constants = require("../app/util/constants");
const ODataParser = require('odata-filter-parser');
const moment = require('moment');

const Predicate = ODataParser.Predicate;
const Operators = ODataParser.Operators;

describe('MySQL Translator tests', () => {

    describe('Generate Update by Key test', () => {
        it("Generate same keys, new values", () => {
            const c = {
                NAME: "Australia-typo",
                ID: 600
            };
            const c_update = {
                NAME: "Australia",
                DESCRIPTION: "This is a description",
                ID: 600
            };
            expect(translator.generateUpdateByFields(country,c_update,c)).toEqual(
               "UPDATE COUNTRIES SET NAME='Australia', DESCRIPTION='This is a description', MODIFYSTAMP=CURDATE() WHERE ID=600"
           );
        });

        it("Nothing different generates update timestamp", () => {
            const c = {
                NAME: "Australia",
                ID: 600
            };
            expect(translator.generateUpdateByFields(country,c,c)).toEqual("UPDATE COUNTRIES SET MODIFYSTAMP=CURDATE() WHERE ID=600");
        });

        it("obj_array does not generate update", () => {
            const a = {
                NAME: "British Europe",
                COUNTRIES: [4, 3],
                ID: 25
            };
            const b = {
                NAME: "British Europe",
                COUNTRIES: [2, 5, 7],
                ID: 25
            };
            const update = translator.generateUpdateByFields(album, b, a);
            expect(update.indexOf("COUNTRIES")).toBe(-1);
        });
    });

    describe('Generate Insert Statement tests', () => {
        it("Country with full parameters", () => {
            const c = {
                name: "Australia",
                description: "This is my description",
                id: 700
            };
            expect(translator.generateInsertStatement(country, c)).toEqual(
                "INSERT INTO COUNTRIES (NAME,DESCRIPTION,ID,CREATESTAMP) VALUES('Australia','This is my description',700,CURDATE())"
            );
        });
        
        it("Country with create timestamp pre-set", () => {
            const date = moment().subtract(1, 'days').toDate();
            const dStr = moment(date).format(Constants.MYSQL_DATEFORMAT);
            const c = {
                name: "Australian States - Queensland",
                id: 150,
                createTimestamp: date
            };
            expect(translator.generateInsertStatement(country, c)).toEqual(
                "INSERT INTO COUNTRIES (NAME,ID,CREATESTAMP) VALUES('Australian States - Queensland',150,'" + dStr + "')"
            );
            
        });

        it("Preference with full parameters", () => {
            const p = {
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
            const ids = [654];
            expect(translator.generateInValueStatement(ids)).toEqual("(654)");
        });
        it("Multiple values", () => {
            const ids = [4, 5, 7, 12];
            expect(translator.generateInValueStatement(ids)).toEqual("(4,5,7,12)");
        });
        it("No values", () => {
            const ids = [];
            expect(translator.generateInValueStatement(ids)).toEqual("");
        });
    });

    describe('Generate WhereClause statements', () => {
        it("Generate less than clause", () => {
            const output = translator.toWhereClause(new Predicate({
                subject: 'value',
                operator: Operators.LESS_THAN,
                value: 100
            }), [catalogueNumber]);
            expect(output).toEqual("c.CATALOGUEVALUE<100");
        });
        it("Generate less than equal clause", () => {
            const output = translator.toWhereClause(new Predicate({
                subject: 'value',
                operator: Operators.LESS_THAN_EQUAL,
                value: 50.50
            }), [catalogueNumber]);
            expect(output).toEqual("c.CATALOGUEVALUE<=50.5");
        });
        it("Generate greater than clause", () => {
            const output = translator.toWhereClause(new Predicate({
                subject: 'value',
                operator: Operators.GREATER_THAN,
                value: 100
            }), [catalogueNumber]);
            expect(output).toEqual("c.CATALOGUEVALUE>100");
        });
        it("Generate greater than clause with Date", () => {
            const d = new Date();
            const dStr = d.toISOString(); // equivalent to date string passed on URLs
            const output = translator.toWhereClause(new Predicate({
                subject: 'purchased',
                operator: Operators.GREATER_THAN,
                value: 'datetimeoffset\'' + dStr + '\''
            }), [ownership]);

            const str = new moment(d).format(Constants.MYSQL_DATEFORMAT);
            expect(output).toEqual("o.PURCHASED>'" + str + "'");
        });

        it("Generate greater than clause with Date object", () => {
            const d = new Date();
            const output = translator.toWhereClause(new Predicate({
                subject: 'purchased',
                operator: Operators.GREATER_THAN,
                value: d
            }), [ownership]);

            const str = new moment(d.toISOString()).format(Constants.MYSQL_DATEFORMAT);
            expect(output).toEqual("o.PURCHASED>'" + str + "'");
        });

        it("Generate greater than equal clause", () => {
            const output = translator.toWhereClause(new Predicate({
                subject: 'value',
                operator: Operators.GREATER_THAN_EQUAL,
                value: 50.50
            }), [catalogueNumber]);
            expect(output).toEqual("c.CATALOGUEVALUE>=50.5");
        });
        it("Generate OR clause with brackets", () => {
            const p = Predicate.concat(Operators.OR, [
                new Predicate({subject: 'condition', value: 1}),
                new Predicate({subject: 'condition', value: 4})
            ]);

            const output = translator.toWhereClause(p, [catalogueNumber]);
            expect(output).toEqual("(c.CAT_CONDITION=1 OR c.CAT_CONDITION=4)");
        });

        it("Generate AND clause", () => {
            const p = Predicate.concat(Operators.AND, [
                new Predicate({subject: 'active', value: 1}),
                new Predicate({subject: 'catalogueRef', value: 23})
            ]);

            const output = translator.toWhereClause(p, [catalogueNumber]);
            expect(output).toEqual("c.ACTIVE=1 AND c.CATALOGUE_REF=23");
        });

        it("Generate AND with OR clause", () => {
            const p = Predicate.concat(Operators.AND, [
                new Predicate({subject: 'active', value: 1}),
                new Predicate({subject: 'catalogueRef', value: 23}),
                Predicate.concat(Operators.OR, [
                    new Predicate({subject: 'condition', value: 1}),
                    new Predicate({subject: 'condition', value: 4}),
                    new Predicate({subject: 'condition', value: 7})
                ])

            ]);

            const output = translator.toWhereClause(p, [catalogueNumber]);
            expect(output).toEqual(
                "c.ACTIVE=1 AND c.CATALOGUE_REF=23 AND (c.CAT_CONDITION=1 OR (c.CAT_CONDITION=4 OR c.CAT_CONDITION=7))"
            );
        });
    });
});