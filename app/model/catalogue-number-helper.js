let _ = require('lodash');
let zpad = require('zpad');
let Logger = require('../util/logger');
let PREFIX = require('./prefix.json');

module.exports = function () {
    let logger = Logger.getLogger("server");

    function generatePrefix(prefix, catalogueType) {
        let lookup = 'STANLEY_GIBBONS';
        switch(catalogueType) {
            case 1:
                lookup = 'SCOTT';
                break;
            case 2:
                lookup = 'MICHEL';
                break;
            case 3:
                lookup = 'FACIT';
                break;
            case 4:
                lookup = 'OTHER';
                break;
            case 5:
                lookup = 'DARNELL';
                break;
            case 6:
                lookup = 'BRIDGER_AND_KAY';
                break;
            case 7:
                lookup = 'VAN_DAM';
                break;
            case 8:
                lookup = 'JSCA';
                break;
        }
        let result = '100';
        if (!_.isEmpty(prefix)) {
            prefix = prefix.trim();
            let val = PREFIX[lookup][prefix];
            if(val) {
                result = '' + val;
            } else {
                logger.warn('Unknown prefix for type ', catalogueType, '-->', prefix);
                result = new String(999);
            }
        }
        //  console.log(result);
        return result;
    }

    return {
        serialize: function (cn, catalogues) {
            let result = cn.NUMBER;
            if (cn.NUMBER) {
                let m = /^([a-zA-Z- ]*)([\d{1,5}]*)(.*)?$/g;
                let parts = m.exec(cn.NUMBER);
                m.lastIndex = 0;
                if (parts && parts.length > 3) {
                    //console.log(parts);
                    let prefix = generatePrefix(parts[1], _.find(catalogues, {ID: cn.CATALOGUE_REF}).TYPE);
                    let num = zpad(parts[2], 5);
                    let postfix = parts[3]
                    result = prefix + num;
                    if (!_.isEmpty(postfix)) {
                        result += postfix.replace(/\s/g, '').trim();
                    }
                    //console.log('r=' + result);
                }
            }
            return result;
        }
    }
}();