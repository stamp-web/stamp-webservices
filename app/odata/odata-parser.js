var _ = require('../../lib/underscore/underscore');

var ODataParser2 = function() {

    "use strict";

    var REGEX = {
        parenthesis: /^([(](.*)[)])$/,
        andor: /^(.*?) (or|and)+ (.*)$/,
        op: /(\w*) (eq|gt|lt|ge|le|ne) (datetimeoffset'(.*)'|'(.*)'|[0-9]*)/,
        startsWith: /^startswith[(](.*),'(.*)'[)]/,
        endsWith: /^endswith[(](.*),'(.*)'[)]/,
        contains: /^contains[(](.*),'(.*)'[)]/
    };

    function buildLike(match,key) {
        var right = (key === 'startsWith') ? match[2] + '*' : (key === 'endsWith') ? '*' + match[2] : '*' + match[2] + '*';
        if( match[0].charAt(match[0].lastIndexOf(')')-1) === "\'") {
            right = "\'" + right + "\'";
        }
        return {
            left: match[1],
            type: 'like',
            right: right
        };
    }

    return {
        parse: function(filterStr) {
            var self = this;
            if( !filterStr ) {
                return null;
            }
            var filter = filterStr.trim();
            var obj = {};
            if( filter.length > 0 ) {
                obj = self.parseFragment(filter);
            }
            return obj;
        },

        parseFragment: function(filter) {
            var self = this;
            var found = false;
            var obj = null;
            _.each( REGEX, function( regex, key ) {
                if( found ) {
                    return;
                }
                var match = filter.match(regex);
                if( match ) {

                    switch (regex) {
                        case REGEX.parenthesis:
                            if( match.length > 2 ) {
                                console.log(match);
                                if( match[2].indexOf(')') < match[2].indexOf('(')) {
                                    return true;
                                }
                                obj = self.parseFragment(match[2]);
                            }
                            break;
                        case REGEX.andor:
                            obj = {
                                left: self.parseFragment(match[1]),
                                type: match[2],
                                right: self.parseFragment(match[3])
                            };
                            break;
                        case REGEX.op:
                            obj = {
                                left: match[1],
                                type: match[2],
                                right: ( match[3].indexOf('\'') === -1) ? +match[3] : match[3]
                            };
                            break;
                        case REGEX.startsWith:
                        case REGEX.endsWith:
                        case REGEX.contains:
                             obj = buildLike(match,key);
                             break;
                    }
                    found = true;
                }
            });
            return obj;
        }
    };
}();

module.exports = ODataParser2;