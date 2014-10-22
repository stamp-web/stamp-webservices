var _ = require('../../lib/underscore/underscore');
require("./string-utilities");
var logger = require('../util/logger');


function ODataParser() {
    "use strict";
    return {
        indexOfMatchingParenthesis : function (s, startIndx) {
            var indx = -1;

            for (var i = startIndx; i < s.length; i++) {
                if (s[i] === '(' && i !== startIndx) {
                    var j = this.indexOfMatchingParenthesis(s.substring(i + 1), 0);
                    if (j > 0) {
                        indx = j + i;
                        i += j + 1;
                        continue;
                    }
                    throw new Error("not valid - no matching parenthesis for " + s);
                } else if (s[i] === ')') {
                    indx = i;
                    break;
                }
            }
            return indx;
        },
        toPredicates: function ($filter) {
            var obj = {};
            if ($filter) {
                $filter = $filter.trim();
                var indx = $filter.indexOf('(');
                if (indx >= 0) {
                    var lastIndx = this.indexOfMatchingParenthesis($filter, 0);
                    var f = $filter.substring(indx + 1, lastIndx);
                    if (f.indexOf('(') === 0) {
                        var p = this.toPredicates(f);
                        if (f.indexOf(')') <= f.length -1) {
                            obj.left = p;
                        }
                        return this.toPredicates(f);
                    } else {
                         $filter = f;
                    }
                }
                var tokens = $filter.split(' ');
                if (tokens.length >= 3) {
                    obj = {
                        left: tokens[0],
                        type: tokens[1],
                        right: tokens[2]
                    };
                    if (obj.right.indexOf('(') === 0) {
                        obj.right = this.toPredicates(obj.right);
                    }
                    if (obj.right.indexOf("\'") < 0) {
                        obj.right = +obj.right;
                    } else {
                        if (obj.right.lastIndexOf("\'") !== obj.right.length - 1) {
                            for (var i = 3; i < tokens.length; i++) {
                                obj.right += " " + tokens[i];
                                if (tokens[i].endsWith("\'")) {
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    throw new Error("Insufficient tokens for " + $filter);
                }
            }
            return obj;
        }
    };
}

module.exports = new ODataParser();
