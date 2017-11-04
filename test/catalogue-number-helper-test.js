var superagent = require('superagent');
var expect = require('expect.js');
var CatalogueNumberHelper = require('../app/model/catalogue-number-helper');

"use strict";
describe('Catalogue number helper test', () => {
    let catalogue = [
        {
            ID:       5,
            TYPE:     0,
            CURRENCY: 'GBP'
        },
        {
            ID:       10,
            TYPE:     1,
            CURRENCY: 'USD'
        },
        {
            ID:       20,
            TYPE:     2,
            CURRENCY: 'EUR'
        }
    ];

    describe('serialization of Stanley Gibbons', () => {
        it('Simple numbers', () => {
            let cn = {
                NUMBER:        '5',
                CATALOGUE_REF: 5
            };
            let result = CatalogueNumberHelper.serialize(cn, catalogue);
            expect(result).to.eql('10000005');

            cn.NUMBER = '67';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('10000067');
        });

        it('Numbers with postfix', function () {
            let cn = {
                NUMBER:        '5 a',
                CATALOGUE_REF: 5
            };
            let result = CatalogueNumberHelper.serialize(cn, catalogue);
            expect(result).to.eql('10000005a');

            cn.NUMBER = '5ab';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('10000005ab');
        });

        it('Numbers with prefix', function () {
            let cn = {
                NUMBER:        'MS101',
                CATALOGUE_REF: 5
            };
            let result = CatalogueNumberHelper.serialize(cn, catalogue);
            expect(result).to.eql('10000101');

            cn.NUMBER = 'MS 101';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('10000101');
        });
    });

    describe('serialization of Michel', function () {

        it('Simple numbers', function () {
            let cn = {
                NUMBER:        '5',
                CATALOGUE_REF: 20
            };
            let result = CatalogueNumberHelper.serialize(cn, catalogue);
            expect(result).to.eql('10000005');

            cn.NUMBER = '67';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('10000067');
        });

        it('Numbers with postfix', function () {
            let cn = {
                NUMBER:        '5 a',
                CATALOGUE_REF: 20
            };
            let result = CatalogueNumberHelper.serialize(cn, catalogue);
            expect(result).to.eql('10000005a');

            cn.NUMBER = '5 HAN H36700.2';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('10000005HANH36700.2');
        });

        it('Numbers with prefix', function () {
            let cn = {
                NUMBER:        'HB 25',
                CATALOGUE_REF: 20
            };
            let result = CatalogueNumberHelper.serialize(cn, catalogue);
            expect(result).to.eql('12500025');

            cn.NUMBER = 'K25';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('15000025');

            cn.NUMBER = 'RL5.2';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('15400005.2');

            cn.NUMBER = 'O5';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('35000005');

            cn.NUMBER = 'O 5';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('35000005');
        });

        it('Numbers with full values', function () {
            let cn = {
                NUMBER:        'H-Blatt 23 IV',
                CATALOGUE_REF: 20
            };
            let result = CatalogueNumberHelper.serialize(cn, catalogue);
            expect(result).to.eql('12500023IV');

            cn.NUMBER = 'K 25 a II';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('15000025aII');

            cn.NUMBER = 'RL 5.2 IV';
            expect(CatalogueNumberHelper.serialize(cn, catalogue)).to.eql('15400005.2IV');
        });
    });
});

