var _ = require('lodash');
var Logger = require('../util/logger');
var moment = require('moment');
var Predicate = require('odata-filter-parser').Predicate;
var Operators = require('odata-filter-parser').Operators;
require("../util/string-utilities");
var Constants = require("../util/constants");

var logger = Logger.getLogger("server");

function DataTranslator() {
    "use strict";
    function validateBinaryOperation(el) {
        if (typeof el.subject === 'undefined' || typeof el.value === 'undefined') {
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
                        msg = { message: "A value for field '" + m + "' is required", code: "REQUIRED_FIELD" };
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
                if( definition.type === 'id_array' || definition.type === 'obj_array') {
                    return;
                }
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
        // TODO: delete once generateInsertStatement is no longer used
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
        /**
         * Generate a valid value statement (x,x,x,x) for the array of objects
         *
         * @param ids
         * @returns {string}
         */
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
                logger.warn("The fieldDefinition parameter was not defined.");
            }
            var processExpression = function (el) {
                if (typeof el === 'string') {
                    return;
                } else if (el instanceof Predicate) {
                    var op = '=';
                    var binaryOp = true;
                    switch (el.operator) {
                        case Operators.EQUALS:
                            break;
                        case Operators.LESS_THAN:
                            op = '<';
                            break;
                        case Operators.GREATER_THAN:
                            op = '>';
                            break;
                        case Operators.GREATER_THAN_EQUAL:
                            op = '>=';
                            break;
                        case Operators.LESS_THAN_EQUAL:
                            op = '<=';
                            break;
                        case Operators.LIKE:
                            op = ' LIKE ';
                            break;
                        case Operators.AND:
                        case Operators.OR:
                            binaryOp = false;
                            var or = el.operator === Operators.OR;
                            var left = that.toWhereClause(el.subject, fieldDefinitions);
                            var right = that.toWhereClause(el.value, fieldDefinitions);
                            expression += (or ? '(' : '') + left + ' ' + el.operator.toUpperCase() + ' ' + right + (or ? ')' : '');
                            break;
                        default:
                            throw new Error("Unrecognized operator type");
                    }
                    if (binaryOp) {
                        validateBinaryOperation(el);
                        var subject = el.subject;
                        var value;
                        if (typeof el.value !== 'undefined') {
                            var val = el.value;
                            value = (_.isNumber(val)) ? +val : _.isString(val) ? val.replace(/\*/g,'%') : '' + val;
                        }
                        var predicate = subject;
                        for (var i = 0; i < fieldDefinitions.length; i++) {
                            var definition = fieldDefinitions[i];
                            var field = _.findWhere(definition.getFieldDefinitions(), { field: subject });
                            if (field && field.column && !field.nonPersistent) {
                                predicate = ((definition.getAlias()) ? definition.getAlias() + '.' : '') + field.column;
                                if (field.type === 'date' && value.startsWith(Constants.DATEOFFSET_STARTING)) {
                                    value = value.substring(Constants.DATEOFFSET_STARTING.length, value.length - 1);
                                    value = "\'" + new moment(value).format(Constants.MYSQL_DATEFORMAT)  + "\'";
                                }
                                expression += predicate + op + value;
                                break;
                            } else {
                                var expr = definition.getSpecialExpression(subject, op, value);
                                if( expr !== null ) {
                                   expression += expr;
                                   break;
                                }
                            }
                        }

                    }
                }
            };
            if (_.isArray($filter)) {
                _.each($filter, processExpression);
            } else if (typeof $filter === 'object') {
                processExpression($filter);
            }
            logger.debug("Expression is: " + expression);
            return expression;

        }
    };
}

module.exports = new DataTranslator();