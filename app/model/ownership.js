const extend = require('node.extend');
const fieldDefinition = require('./field-definition');
const NumericUtilities = require('../util/numeric-utilities');

const ownership = extend({}, fieldDefinition, function() {
    return {
        getFieldDefinitions: function () {
            return [
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'pricePaid', column: 'PRICE', type: 'float' },
                { field: 'purchased', column: 'PURCHASED', type: 'date', externalizeOnEmpty: false },
                { field: 'grade', column: 'GRADE', type: 'int' },
                { field: 'condition', column: 'THECONDITION', type: 'int' },
                { field: 'img', column: 'IMAGE', type: 'string', externalizeOnEmpty: false },
                { field: 'notes', column: 'NOTES', type: 'string', externalizeOnEmpty: false },
                { field: 'code', column: 'CURRENCY', type: 'string' },
                { field: 'stampRef', column: 'STAMP_ID', type: 'long', required: true, joinWith: 'STAMPS', internal: true },
                { field: 'albumRef', column: 'ALBUM_ID', type: 'long', joinWith: 'ALBUMS' },
                { field: 'defects', column: 'DEFECTS', type: 'int' },
                { field: 'deception', column: 'DECEPTION', type: 'int' },
                { field: 'sellerRef', column: 'SELLER_ID', type: 'long', joinWith: 'SELLERS' },
                { field: 'cert', column: 'CERTIFIED', type: 'boolean' },
                { field: 'certImg', column: 'CERTIFIED_IMAGE', type: 'string', externalizeOnEmpty: false },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true }
            ];
        },

        getSpecialExpression: function(key, op, value) {
            let exp = "";
            switch(key) {
                case 'stampCollectionRef':
                    exp = this.getAlias() + '.ALBUM_ID IN (SELECT ID FROM ALBUMS WHERE COLLECTION_ID=' + value + ')';
                    break;
            }
            return exp;
        },
        getSequenceColumn: function () {
            return "OWNERSHIP_ID";
        },
        getTableName: function () {
            return "OWNERSHIP";
        },
        getAlias: function () {
            return "o";
        },
        getCalculatedValue: (v, grade, deception, defects) => {
            let value = v;
            switch(grade) {
                case 0:
                case 1:
                    value *= 0.35;
                    break;
                case 2:
                    value *= 0.25;
                    break;
                case 3:
                    value *= 0.15;
                    break;
                case 4:
                    value *= 0.10;
                    break;
                default:
                    value = 0.0;
            }
            if(deception > 0) {
                /**
                 * Any deception will be evaluated at 1% unless it is a possible forgery or a reprint in which case we will use 25%
                 */
                const dc = NumericUtilities.determineShiftedValues(deception)
                if(dc.includes(32) || dc.includes(128)) {
                    value = v * 0.25
                } else {
                    value = v * 0.01
                }
            } else if (defects > 0) {
                const d = NumericUtilities.determineShiftedValues(defects)
                /*
                    The following is the value table that will be used:

                      * 0% - Torn, Soiled
                      * 5% - Thin, Pinhole, Scuffed, Clipped, Ink Stain or Changeling
                      * 15% - all other minor flaws (like short perforation)
                 */
                if(d.includes(4) || d.includes(524288)) {
                    value = 0;
                } else if (d.includes(2) || d.includes(64) || d.includes(32) || d.includes(512) || d.includes(4096) || d.includes(8192)) {
                    value *= 0.05
                } else {
                    value *= 0.15
                }
            }
            return value;
        }
    };
}());

module.exports = ownership;
