var _ = require('lodash');
var zpad = require('zpad');

var PREFIX = require('./prefix.json');

module.exports = function () {


    function generatePrefix(prefix, catalogueType) {
        let lookup = 'STANLEY_GIBBONS';
        switch(catalogueType) {
            case 1:
                lookup = 'SCOTT';
                break;
            case 2:
                lookup = 'MICHEL';
                break;
            case 7:
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
                console.log('Unknown prefix for type ', catalogueType, '-->', prefix);
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
                    let postfix = parts[3];
                    result = prefix + num;
                    if (!_.isEmpty(postfix)) {
                        result += postfix.trim();
                    }
                    //console.log('r=' + result);
                }
            }
            return result;
        }
    }
}();