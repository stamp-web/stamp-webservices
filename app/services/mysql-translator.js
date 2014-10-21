var _ = require('../../lib/underscore/underscore');
var Logger = require('../util/logger');
require("date-utils");
require("../util/string-utilities");
var Constants = require("../util/constants");

var logger = Logger.getLogger("server");

function DataTranslator() {
    "use strict";
    function validateBinaryOperation(el) {
        if (!el.left || !el.right) {
            throw new Error("left and right sides of expression are required.");
        }
    }
    
    return {
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

        generateUpdateByFields: function(fieldDefinition, proposed, current, onlyWithFields) {
            var expr = "";
            _.each(Object.keys(proposed), function(key) {
               var definition = _.findWhere(fieldDefinition.getFieldDefinitions(), { column: key});
               if( proposed[key] !== current[key]) {
                   var val = fieldDefinition.formatValue(definition,proposed[key]);
                   if( val !== undefined ) {
                       expr += ((expr.length > 0 ) ? ", " : "") + key + "=" + val;
                   }
               }
            });
            if( !onlyWithFields || (onlyWithFields && expr.length > 0) ) {
                var modifyField = _.findWhere(fieldDefinition.getFieldDefinitions(), { field: 'modifyTimestamp' });
                if( modifyField && !proposed[modifyField.column] ) {
                    expr += ((expr.length > 0) ? ", " : "") + modifyField.column + "=CURDATE()";
                }
                expr = "UPDATE " + fieldDefinition.getTableName() + " SET " + expr + " WHERE ID=" + current.ID;
            } else {
                expr = null;
            }
            return expr;
        },
        generateInsertByFields: function (fieldDefinition, obj) {
            var config = { DB_COLS: [], VALUES: [] };
            _.each(Object.keys(obj), function(col) {
                var definition = _.findWhere(fieldDefinition.getFieldDefinitions(), { column: col });
                config.DB_COLS.push(col);
                config.VALUES.push(fieldDefinition.formatValue(definition, obj[col]));
            });
            if ( _.indexOf(config.DB_COLS, "CREATESTAMP") < 0) {
                config.DB_COLS.push("CREATESTAMP");
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
                    var val = fieldDefinition.formatValue(definition,value);
                    if( val === undefined ) {
                        return;
                    }
                    config.DB_COLS.push(definition.column);
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
        
        toWhereClause: function ($filter, fieldDefinitions) {
            var expression = '';
            var that = this;
            if (!fieldDefinitions) {
                logger.log(Logger.WARN, "The fieldDefinition parameter was not defined.");
            }
            var processExpression = function (el) {
                if (typeof el === 'string') {
                    return;
                } else if (typeof el === 'object' && el.type) {
                    var op = '=';
                    var binaryOp = true;
                    switch (el.type) {
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
                            var left = that.toWhereClause(el.left, fieldDefinitions);
                            var right = that.toWhereClause(el.right, fieldDefinitions);
                            expression += left + ' ' + el.type.toUpperCase() + ' ' + right;
                            break;
                        default:
                            throw new Error("Unrecognized operator type");
                    }
                    if (binaryOp) {
                        validateBinaryOperation(el);
                        var subject = el.left;
                        var value;
                        if (el.right) {
                            var val = el.right;
                            value = (_.isNumber(val)) ? +val : '' + val;
                        }
                        var predicate = subject;
                        for (var i = 0; i < fieldDefinitions.length; i++) {
                            var definition = fieldDefinitions[i];
                            var field = _.findWhere(definition.getFieldDefinitions(), { field: subject });
                            if (field && field.column && !field.nonPersistent) {
                                predicate = ((definition.getAlias()) ? definition.getAlias() + '.' : '') + field.column;
                                if (field.type === 'date' && value.startsWith(Constants.DATEOFFSET_STARTING)) {
                                    value = value.substring(Constants.DATEOFFSET_STARTING.length, value.length - 1);
                                    var d = new Date(value);
                                    value = "\'" + d.toFormat(Constants.MYSQL_DATEFORMAT) + "\'";
                                }
                                break;
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