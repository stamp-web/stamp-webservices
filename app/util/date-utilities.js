Date.prototype.isDST = Date.prototype.isDST || function() { //t is the date object to check, returns true if daylight saving time is in effect.
    const jan = new Date(this.getFullYear(), 0, 1);
    const jul = new Date(this.getFullYear(), 6, 1);
    return Math.min(jan.getTimezoneOffset(),jul.getTimezoneOffset()) == this.getTimezoneOffset();
};

exports.DataUtilities = {};