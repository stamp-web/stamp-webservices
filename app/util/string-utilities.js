String.prototype.startsWith = function (str) {
    "use strict";
    //noinspection JSHint,JSCheckFunctionSignatures
    return (this.match("^" + str) == str);
};

String.prototype.endsWith = function (suffix) {
    "use strict";
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

exports.StringUtilities = {};