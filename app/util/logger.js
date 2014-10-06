
var fs = require('fs');
function logger() {
    
    var levels = ['error', 'warn', 'info', 'debug', 'trace', 'all'];
    var debugLevel = "warn";
    var target = "console";
    var targetPath;

    return {
        
        ERROR : levels[0],
        WARN : levels[1],
        INFO : levels[2],
        DEBUG : levels[3],
        TRACE : levels[4],
        ALL : levels[5],
        
        setTarget: function (type, item) {
            target = type;
            targetPath = item;
        },
        
        log : function (level, message) {
            if (this.enabled(level)) {
                if (typeof message !== 'string') {
                    message = JSON.stringify(message);
                }
                var msg = level.toUpperCase() + ': ' + message;
                if (target === "file" && targetPath) {
                    fs.appendFileSync(targetPath, msg + '\n');
                } else {
                    console.log(msg);
                }
            }
        },
        
        setLevel : function (level) {
            debugLevel = level;
        },
        
        enabled : function (level) {
            return (levels.indexOf(level) <= levels.indexOf(debugLevel));
        }
    }
};
module.exports = logger();
