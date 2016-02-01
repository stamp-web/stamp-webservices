var extend = require('node.extend');
var _ = require('lodash');
var fieldDefinition = require('./field-definition');

var catalogueNumber = extend({}, fieldDefinition, function () {
    "use strict";

    var JSCA_PREFIXES = {
        "A": 5000,
        "C": 5010,
        "P": 5030,
        "N": 5040,
        "R": 5050,
        "OK": 7100,
        "OC": 7110,
        "M": 5120,
        "O": 5100,
        "PC": 5200,
        "PP": 5210
    };

    var STANLEY_GIBBONS_PREFIXES = {
        "RAB": 7270,
        "RAC": 7280,
        "RAJ": 7290,
        "ED": 5010,
        "MS": 0,
        "MD": 5080,
        "OB": 5110,
        "OS": 5120,
        "SB": 5030,
        "TD": 5160,
        "ZA": 5180,
        /* Scott */
        "AR": 7300,
        "NJ": 7320,
        "NB": 7330,
        "QB": 7220,
        "MQ": 7230,
        "QY": 7240,
        "QE": 7250,
        "RA": 7260,
        "CB": 7020,
        "CE": 7030,
        "CO": 7040,
        "CQ": 7050,
        "MC": 7060,
        "GY": 7090,
        "EB": 7120,
        "EO": 7130,
        "MR": 7160,
        "OL": 7180,
        "OY": 7190,
        "H": 5000,
        "E": 5001,
        "K": 5003,
        "U": 5004,
        "G": 5005,
        "M": 5020,
        "N": 5022,
        "R": 5040,
        "S": 5050,
        "B": 5060,
        "D": 5070,
        "V": 5090,
        "O": 5100,
        "P": 5130,
        "L": 5140,
        "T": 5150,
        "Z": 5170,
        "F": 5190,
        "A": 5200,
        /* Scott */
        "C": 7010,
        "I": 7100,
        "J": 7150,
        "Q": 7210
    };

    var MICHEL_PREFIXES = {
        "KZ" : 5004,
        "Block": 0,
        "H-Blatt": 5000,
        "W" : 5041,
        "WZ": 5042
    };

    var SCOTT_PREFIXES = {



    };


    var PREFIX_LIST = _.extend({},/*SCOTT_PREFIXES,*/ STANLEY_GIBBONS_PREFIXES, MICHEL_PREFIXES, JSCA_PREFIXES);
    var sortString;

    return {
        getFieldDefinitions: function () {
            return [
                { field: 'id', column: 'ID', type: 'long', required: true },
                { field: 'value', column: 'CATALOGUEVALUE', type: 'float' },
                { field: 'number', column: 'NUMBER', type: 'string', sortFn: this.catalogueNumberSort },
                { field: 'unknown', column: 'UNKNOWN_VALUE', type: 'boolean', externalizeOnEmpty: false },
                { field: 'condition', column: 'CAT_CONDITION', type: 'int' },
                { field: 'nospace', column: 'NOTAVAILABLE', type: 'boolean', externalizeOnEmpty: false },
                { field: 'active', column: 'ACTIVE', type: 'boolean' },
                { field: 'stampRef', column: 'STAMP_ID', type: 'long', required: true, joinWith: 'STAMPS', internal: true },
                { field: 'catalogueRef', column: 'CATALOGUE_REF', type: 'long', joinWith: 'CATALOGUES' },
                { field: 'createTimestamp', column: 'CREATESTAMP', type: 'date', internal: true },
                { field: 'modifyTimestamp', column: 'MODIFYSTAMP', type: 'date', internal: true }
            ];
        },
        getSequenceColumn: function () {
            return "CATNUM_ID";
        },
        getTableName: function () {
            return "CATALOGUENUMBERS";
        },
        getAlias: function () {
            return "c";
        },
        catalogueNumberSort: function () {
            if (!sortString) {
                sortString = 'CAST(';
                var replace = '';
                var keys = Object.keys(PREFIX_LIST);
                var that = this;
                _.each(keys,function(key) {
                    if( replace.length === 0 ) {
                        replace ='REPLACE(' + that.getAlias() + '.NUMBER,\'' + key + '\',' + PREFIX_LIST[key] + ')';
                    } else {
                        replace = 'REPLACE(' + replace + ',\'' + key + '\',' + PREFIX_LIST[key] + ')';
                    }
                });
                sortString += replace + " AS UNSIGNED)," + this.getAlias() + ".NUMBER";
            }
            return sortString;
        }

    };
}());

module.exports = catalogueNumber;
