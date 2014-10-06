var superagent = require('superagent')
var expect = require('expect.js')
var _ = require('../lib/underscore/underscore');
var parser = require("../app/util/odata-parser");
var country = require("../app/model/country");

describe('OData Parser Tests', function (done) {

    describe('OData Matching Parenthesis Tests', function () {
        
        it("Simple Parenthesis", function () {
            var s = "(a eq 5)";
            var idx = parser.indexOfMatchingParenthesis(s, 0);
            expect(idx).to.be.eql(s.length - 1);
        });
        
        it("Double Parenthesis", function () {
            var s = "((a eq 'b'))";
            var idx = parser.indexOfMatchingParenthesis(s, 0);
            expect(idx).to.be.eql(s.length - 1);
        });
        
        it("Compound Parenthesis", function () {
            var s = "((a eq 'b') and (c gt 5))";
            var idx = parser.indexOfMatchingParenthesis(s, 0);
            expect(idx).to.be.eql(s.length - 1);
        });

        it("Mismatched Parenthesis", function () {
            var s = "(a eq 'b'";
            var idx = parser.indexOfMatchingParenthesis(s, 0);
            expect(idx).to.be.eql(-1);
        });
        
    });
    
    describe('OData Predicate Tests', function () {

        it('Simple binary expression test', function () {
            var s = "name eq 'test'";
            var obj = parser.toPredicates(s);
            expect(obj.left).to.be.eql("name");
            expect(obj.type).to.be.eql("eq");
            expect(obj.right).to.be.eql("'test'");
        });
        
        it('Simple binary expression with String with spaces', function () {
            var s = "name eq 'test of strings'";
            var obj = parser.toPredicates(s);
            expect(obj.left).to.be.eql("name");
            expect(obj.type).to.be.eql("eq");
            expect(obj.right).to.be.eql("'test of strings'");
        });

        it('Simple binary expression with a number value', function () {
            var s = "id gt 5";
            var obj = parser.toPredicates(s);
            expect(obj.left).to.be.eql("id");
            expect(obj.type).to.be.eql("gt");
            expect(_.isNumber(obj.right)).to.be.ok();
            expect(obj.right).to.be.eql(5);
        });

        it('Simple binary expression with a number value enclosed with parenthesis', function () {
            var s = "(id lt 5)";
            var obj = parser.toPredicates(s);
            expect(obj.left).to.be.eql("id");
            expect(obj.type).to.be.eql("lt");
            expect(_.isNumber(obj.right)).to.be.ok();
            expect(obj.right).to.be.eql(5);
        });

        it.skip('Compound binary expression with parenthesis on right', function () {
            var s = "((name eq 'Bob') and (id gt 5))";
            var obj = parser.toPredicates(s);
            console.log(obj);
            /*expect(obj.left).to.be.eql("id");
            expect(obj.type).to.be.eql("gt");
            expect(obj.right).to.be.eql("5");*/
        });

    });
});
