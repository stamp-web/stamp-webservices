const _ = require('lodash');
const Logger = require('../util/logger');
const moment = require('moment');
const Predicate = require('odata-filter-parser').Predicate;
const Operators = require('odata-filter-parser').Operators;
const Constants = require("../util/constants");

function DataTranslator() {
    const logger = Logger.getLogger("sql");

    function validateBinaryOperation(el) {
        if (typeof el.subject === 'undefined' || typeof el.value === 'undefined') {
            throw new Error("left and right sides of expression are required.");
        }
    }
    
    return {
        getErrorMessage: function (err) {
            let msg, m;
            if (!err.processed) {
                switch (err.code) {
                    case 'ER_NO_SUCH_TABLE':
                        msg = { message: err.message, code: 'INTERNAL_ERROR' };
                        break;
                    case 'ER_NO_DEFAULT_FOR_FIELD':
                        m = err.message.substring(err.message.indexOf('\'') + 1);
                        m = m.substring(0, m.indexOf('\''));
                        msg = { message: 'A value for field \'' + m + '\' is required', code: 'REQUIRED_FIELD' };
                        break;
                    case 'ER_DUP_ENTRY':
                        msg = { message: 'The object already exists', code: 'UNIQUENESS_EXCEPTION' };
                        break;
                    case 'ER_TABLEACCESS_DENIED_ERROR':
                        logger.error(err.message);
                        msg = { message: 'Unauthorized to perform the action', code: 'FORBIDDEN'};
                        break;
                    default:
                        msg = { message: err.message, code: 'INTERNAL_ERROR' };
                }
            } else {
                msg = err;
            }
            msg.processed = true;
            return msg;
        },

        generateUpdateByFields: function(fieldDefinition, proposed, current, onlyWithFields) {
            let expr = "";
            _.each(Object.keys(proposed), (key) => {
                const definition = _.find(fieldDefinition.getFieldDefinitions(), {column: key});
                if( proposed[key] !== current[key]) {
                    const val = fieldDefinition.formatValue(definition, proposed[key]);
                    if( val !== undefined ) {
                       expr += ((expr.length > 0 ) ? ", " : "") + key + "=" + val;
                   }
               }
            });
            if( !onlyWithFields || (onlyWithFields && expr.length > 0) ) {
                const modifyField = _.find(fieldDefinition.getFieldDefinitions(), {field: 'modifyTimestamp'});
                if( modifyField && !proposed[modifyField.column] ) {
                    expr += ((expr.length > 0) ? ", " : "") + modifyField.column + "=CURDATE()";
                }
                expr = "UPDATE " + fieldDefinition.getTableName() + " SET " + expr + " WHERE ID=" + current.ID;
            } else {
                expr = null;
            }
            logger.debug("Update Expression: " + expr);
            return expr;
        },
        generateInsertByFields: function (fieldDefinition, obj) {
            const config = {DB_COLS: [], VALUES: []};
            _.each(Object.keys(obj), function(col) {
                const definition = _.find(fieldDefinition.getFieldDefinitions(), {column: col});
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
            let expr = "INSERT INTO " + fieldDefinition.getTableName() + " (";
            for (let i = 0; i < config.DB_COLS.length; i++) {
                expr += config.DB_COLS[i];
                if (i < config.DB_COLS.length - 1) {
                    expr += ",";
                }
            }
            expr += ") VALUES(";
            for (let j = 0; j < config.VALUES.length; j++) {
                expr += "" + config.VALUES[j];
                if (j < config.VALUES.length - 1) {
                    expr += ",";
                }
            }
            expr += ")";
            return expr;
        },

        generateInsertStatement: function (fieldDefinition, obj) {
            const config = this.processFields(fieldDefinition, obj);
            const creationField = _.find(fieldDefinition.getFieldDefinitions(), {field: 'createTimestamp'});
            if (creationField && _.indexOf(config.DB_COLS, "CREATESTAMP") < 0) {
                config.DB_COLS.push(creationField.column);
                config.VALUES.push("CURDATE()");
            }
            let expr = "INSERT INTO " + fieldDefinition.getTableName() + " (";
            for (let i = 0; i < config.DB_COLS.length; i++) {
                expr += config.DB_COLS[i];
                if (i < config.DB_COLS.length - 1) {
                    expr += ",";
                }
            }
            expr += ") VALUES(";
            for (let j = 0; j < config.VALUES.length; j++) {
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
            const config = {
                DB_COLS: [],
                VALUES: []
            };
            _.each(obj, (value, key) => {
                const definition = _.find(fieldDefinition.getFieldDefinitions(), {field: key});
                if (definition && definition.column) {
                    const val = fieldDefinition.formatValue(definition, value);
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
            let id_vals = '';
            const len = ids.length;
            if (len > 0) {
                for (let i = 0; i < len; i++) {
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
            let expression = '';
            if (!fieldDefinitions) {
                logger.warn("The fieldDefinition parameter was not defined.");
            }
            const processExpression = el => {
                if (typeof el === 'string') {
                    return;
                } else if (el instanceof Predicate) {
                    let op = '=';
                    let binaryOp = true;
                    let or,left,right;
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
                            or = el.operator === Operators.OR;
                            left = this.toWhereClause(el.subject, fieldDefinitions);
                            right = this.toWhereClause(el.value, fieldDefinitions);
                            expression += (or ? '(' : '') + left + ' ' + el.operator.toUpperCase() + ' ' + right + (or ? ')' : '');
                            break;
                        default:
                            throw new Error("Unrecognized operator type");
                    }
                    if (binaryOp) {
                        validateBinaryOperation(el);
                        const subject = el.subject;
                        let value;
                        if (typeof el.value !== 'undefined') {
                            const val = el.value;
                            value = (_.isNumber(val)) ? +val : _.isString(val) ? '\'' + val.replace(/\*/g, '%') + '\'' : '' + val;
                        }
                        let predicate = subject;
                        for (let i = 0; i < fieldDefinitions.length; i++) {
                            const definition = fieldDefinitions[i];
                            const field = _.find(definition.getFieldDefinitions(), {field: subject});
                            if (field && field.column && !field.nonPersistent) {
                                predicate = ((definition.getAlias()) ? definition.getAlias() + '.' : '') + field.column;
                                if (field.type === 'date') {
                                    if (value.startsWith('\'' + Constants.DATEOFFSET_STARTING)) {
                                        value = value.substring(Constants.DATEOFFSET_STARTING.length + 1, value.length - 2);
                                    }
                                    value = (_.isDate(value)) ? value.toISOString() : new Date(Date.parse(value)).toISOString();
                                    value = "'" + new moment(value).format(Constants.MYSQL_DATEFORMAT) + "'";
                                }
                                expression += predicate + op + value;
                                break;
                            } else {
                                const expr = definition.getSpecialExpression(subject, op, value);
                                if (expr !== null) {
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