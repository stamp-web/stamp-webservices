var _ = require('../../lib/underscore/underscore');
var Logger = require('../util/logger');
require("date-utils");
require("../util/string-utilities");

var logger = Logger.getLogger("server");

function DataTranslator() {
    function validateBinaryOperation(el) {
        if (!el['left'] || !el['right']) {
            throw new Error("left and right sides of expression are required.");
        }
    }
    
    return {
        MYSQL_DATEFORMAT : "YYYY-MM-DD HH:MI:SS",
        
        getErrorMessage: function (err) {
            var msg;
            if (!err.processed) {
                switch (err.code) {
                    case 'ER_NO_SUCH_TABLE':
                        msg = { message: err.message, code: "INTERNAL_ERROR" };
                        break;
                    case 'ER_NO_DEFAULT_FOR_FIELD':
                        var m = err.message.substring(err.message.indexOf("'") + 1);
                        m = m.substring(0, m.indexOf("'"));
                        msg = { message: "No value provided for required field '" + m + "'", code: "REQUIRED_FIELD" };
                        break;
                    case 'ER_DUP_ENTRY':
                        msg = { message: "The object already exists", code: "UNIQUENESS_EXCEPTION" };
                        break;
                    default:
                        msg = { message: err.message, code: "INTERNAL_ERROR" };
                }
            } else {
                msg = err;
            }
            msg.processed = true;
            return msg;
        },
        generateUpdateStatement: function (fieldDefinition, obj, id) {
            var config = this.processFields(fieldDefinition, obj);
            var modifyField = _.findWhere(fieldDefinition.getFieldDefinitions(), { field: 'modifyTimestamp' });
            if (modifyField && _.indexOf(config.DB_COLS, "MODIFYSTAMP") < 0) {
                config.DB_COLS.push(modifyField.column);
                config.VALUES.push("CURDATE()");
            }
            var expr = "UPDATE " + fieldDefinition.getTableName() + " SET ";
            for (var i = 0; i < config.DB_COLS.length; i++) {
                expr += config.DB_COLS[i] + "=" + config.VALUES[i];
                if (i < config.DB_COLS.length - 1) {
                    expr += ", ";
                }
            }
            expr += " WHERE ID=" + id;
            return expr;
        },
        generateInsertStatement: function (fieldDefinition, obj) {
            var config = this.processFields(fieldDefinition, obj);
            var creationField = _.findWhere(fieldDefinition.getFieldDefinitions(), { field: 'createTimestamp' });
            if (creationField && _.indexOf(config.DB_COLS, "CREATESTAMP") < 0) {
                config.DB_COLS.push(creationField.column);
                config.VALUES.push("CURDATE()");
            }
            var expr = "INSERT INTO " + fieldDefinition.getTableName() + " (";
            for (var i = 0; i < config.DB_COLS.length; i++) {
                expr += config.DB_COLS[i];
                if (i < config.DB_COLS.length - 1) {
                    expr += ",";
                }
            }
            expr += ") VALUES(";
            for (var j = 0; j < config.VALUES.length; j++) {
                expr += "" + config.VALUES[j];
                if (j < config.VALUES.length - 1) {
                    expr += ",";
                }
            }
            expr += ")";
            return expr;
        },
        processFields: function (fieldDefinition, obj) {
            var config = {
                DB_COLS: [],
                VALUES: []
            };
            var that = this;
            _.each(obj, function (value, key) {
                var definition = _.findWhere(fieldDefinition.getFieldDefinitions(), { field : key });
                if (definition && definition.column) {
                    if (definition.type === 'id_array' || definition.type === 'obj_array') {
                        return;
                    }
                    config.DB_COLS.push(definition.column);
                    var val = null;
                    switch (definition.type) {
                        case 'long':
                            val = +value;
                            break;
                        case 'date':
                            if (_.isDate(value)) {
                                val = "\'" + value.toFormat(that.MYSQL_DATEFORMAT) + "\'";
                            } else if (_.isString(value)) {
                                value = new Date(value);
                                val = "\'" + value.toFormat(that.MYSQL_DATEFORMAT) + "\'";
                            }
                            break;
                        case 'boolean':
                            val = (value === true) ? true : false;
                            break;
                        default:
                            val = "\'" + value + "\'";
                    }
                    config.VALUES.push(val);
                }
            });
            return config;
        },
        
        generateInValueStatement: function (ids) {
            var id_vals = '';
            var len = ids.length;
            if (len > 0) {
                for (var i = 0; i < len; i++) {
                    id_vals += ids[i];
                    if (i < len - 1) {
                        id_vals += ',';
                    }
                }
                id_vals = '(' + id_vals + ')';
            }
            return id_vals;
        },
        
        toWhereClause: function ($filter, fieldDefinition, selectors) {
            var expression = '';
            var that = this;
            if (!fieldDefinition) {
                logger.log(Logger.WARN, "The fieldDefinition parameter was not defined.");
            }
            var processExpression = function (el) {
                if (typeof el === 'string') {
                    return;
                } else if (typeof el === 'object' && el['type']) {
                    var op = '=';
                    var binaryOp = true;
                    switch (el['type']) {
                        case 'eq':
                            break;
                        case 'lt':
                            op = '<';
                            break;
                        case 'gt':
                            op = '>';
                            break;
                        case 'ge':
                            op = '>=';
                            break;
                        case 'le':
                            op = '<=';
                            break;
                        case 'and':
                        case 'or':
                            binaryOp = false;
                            var left = that.toWhereClause(el['left'], fieldDefinition, selectors);
                            var right = that.toWhereClause(el['right'], fieldDefinition, selectors);
                            expression += left + ' ' + el['type'].toUpperCase() + ' ' + right;
                            break;
                        default:
                            throw new Error("Unrecognized operator type");
                    }
                    if (binaryOp) {
                        validateBinaryOperation(el);
                        var subject = el['left'];
                        var value;
                        if (el['right']) {
                            var val = el['right'];
                            value = (_.isNumber(val)) ? +val : '' + val;
                        }
                        var predicate = subject;
                        if (fieldDefinition) {
                            for (var i = 0; i < fieldDefinition.length; i++) {
                                var definition = fieldDefinition[i];
                                var internal = definition.toInternal(subject);
                                if (internal) {
                                    predicate = ((selectors && selectors.length > 0) ? selectors[i] + '.' : '') + internal;
                                    break;
                                }
                            }
                        }
                        expression += predicate + op + value;
                    }
                }
            };
            if (_.isArray($filter)) {
                _.each($filter, processExpression);
            } else if (typeof $filter === 'object') {
                processExpression($filter);
            }
            logger.log(Logger.DEBUG, "Expression is: " + expression);
            return expression;

        }
    };
}

module.exports = new DataTranslator();