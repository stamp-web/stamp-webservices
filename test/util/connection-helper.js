var _ = require('../../lib/underscore/underscore');

module.exports = function () {

    return {
        loadFromFile: function (connection, fileContent, callback) {
            var lines = fileContent.match(/^.*((\r\n|\n|\r)|$)/gm);
            var count = lines.length;
            _.each(lines, function (line) {
                line = line.replace('\n', '').replace('\r', '');
                if (line.length < 2) {
                    callback();
                    return;
                }
                connection.query(line, function (err, rows) {
                    if (err) {
                        console.log(err);
                        process.exit(1);
                    }
                    callback();
                });
            });
            return count;
        }
    };
}();