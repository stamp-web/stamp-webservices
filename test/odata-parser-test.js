var superagent = require('superagent')
var expect = require('expect.js')
var _ = require('../lib/underscore/underscore');
var parser = require("../app/util/odata-parser");
var country = require("../app/model/country");

describe('OData Parser Tests', function (done) {

    describe('OData parsing tests', function () {

        it('Simple binary expression test', function () {
            var s = "name eq 'test'";
            var obj = parser.parse(s);
            expect(obj.left).to.be.eql("name");
            expect(obj.type).to.be.eql("eq");
            expect(obj.right).to.be.eql("'test'");
        });
        
        it('Simple binary expression with String with spaces', function () {
            var s = "name eq 'test of strings'";
            var obj = parser.parse(s);
            expect(obj.left).to.be.eql("name");
            expect(obj.type).to.be.eql("eq");
            expect(obj.right).to.be.eql("'test of strings'");
        });

        it('Simple binary expression with a number value', function () {
            var s = "id gt 5";
            var obj = parser.parse(s);
            expect(obj.left).to.be.eql("id");
            expect(obj.type).to.be.eql("gt");
            expect(_.isNumber(obj.right)).to.be.ok();
            expect(obj.right).to.be.eql(5);
        });

        it('Simple binary expression with a number value enclosed with parenthesis', function () {
            var s = "(id lt 5)";
            var obj = parser.parse(s);
            expect(obj.left).to.be.eql("id");
            expect(obj.type).to.be.eql("lt");
            expect(_.isNumber(obj.right)).to.be.ok();
            expect(obj.right).to.be.eql(5);
        });

        it('Compound binary expression with parenthesis on right', function () {
            var s = "((name eq 'Bob') and (id gt 5))";
            var obj = parser.parse(s);
            var left = obj.left;
            var right = obj.right;
            expect(obj.type).to.be.eql("and");
            expect(left.left).to.be.eql("name");
            expect(left.type).to.be.eql("eq");
            expect(left.right).to.be.eql("\'Bob\'");
            expect(right.left).to.be.eql("id");
            expect(right.type).to.be.eql("gt");
            expect(right.right).to.be.eql(5);
        });

        it('More complex multiple binary expressions', function() {
            var s = "(name eq 'Bob' and (lastName eq 'Smiley' and (weather ne 'sunny' or temp ge 54)))";
            var obj = parser.parse(s);
            var left = obj.left;
            var right = obj.right;
            expect(obj.type).to.be.eql("and");
            expect(left.left).to.be.eql("name");
            expect(left.type).to.be.eql("eq");
            expect(left.right).to.be.eql("\'Bob\'");
            expect(right.type).to.be.eql("and");
            left = right.left;
            right = right.right;
            expect(left.left).to.be.eql("lastName");
            expect(left.type).to.be.eql("eq");
            expect(left.right).to.be.eql("\'Smiley\'");

            expect(right.type).to.be.eql("or");
            left = right.left;
            right = right.right;
            expect(left.left).to.be.eql("weather");
            expect(left.type).to.be.eql("ne");
            expect(left.right).to.be.eql("\'sunny\'");
            expect(right.left).to.be.eql("temp");
            expect(right.type).to.be.eql("ge");
            expect(right.right).to.be.eql("54");

        });

        it('Verify startsWith condition', function() {
            var s = "startswith(name,'Ja')";
            var obj = parser.parse(s);
            expect( obj.left).to.be.eql('name');
            expect( obj.right).to.be.eql('\'Ja*\'');
            expect( obj.type).to.be.eql('like');
        })

        it('Verify endsWith condition', function() {
            var s = "endswith(name,'Hole')";
            var obj = parser.parse(s);
            expect( obj.left).to.be.eql('name');
            expect( obj.right).to.be.eql('\'*Hole\'');
            expect( obj.type).to.be.eql('like');
        });

        it('Verify contains condition', function() {
            var s = "contains(name,'Something')";
            var obj = parser.parse(s);
            expect( obj.left).to.be.eql('name');
            expect( obj.right).to.be.eql('\'*Something*\'');
            expect( obj.type).to.be.eql('like');
        });

    });
});
