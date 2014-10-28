
function Level() {
}

Level.levels = [ "error", "warn", "info", "debug", "trace", "all"];

Level.ALL = Level.levels[5];
Level.ERROR = Level.levels[0];
Level.WARN = Level.levels[1];
Level.INFO = Level.levels[2];
Level.DEBUG = Level.levels[3];
Level.TRACE = Level.levels[4];

module.exports = Level;