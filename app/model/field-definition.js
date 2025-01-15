const _ = require('lodash');
const Constants = require('../util/constants');
const Logger = require('../util/logger');
const moment = require('moment');

const fieldDefinition = function () {
    const logger = Logger.getLogger("fieldDefinition");

    return {
        toInternal: function (f) {
            const val = _.find(this.getFieldDefinitions(), {field: f});
            return (val) ? val.column : undefined;
        },
        /**
         * Validate whether the required fields are all provided in the object
         * specified.  This method is used to validate incoming objects for
         * validity.
         *
         * @param obj (JsObject)
         */
        validate: function (obj) {
            let valid = null;
            _.each(this.getFieldDefinitions(), (definition) => {
                if (definition.required === true) {
                    if (!obj[definition.column]) {
                        valid = {
                            code: 'REQUIRED_FIELD',
                            message: 'A value for field \'' + definition.field + '\' is required.',
                            processed: true
                        };
                        return false;
                    }
                }
            });
            return valid;
        },
        formatValue: function (definition, value) {
            if (definition.type === 'id_array' || definition.type === 'obj_array') {
                return undefined;
            }
            let val = null;
            switch (definition.type) {
                case 'long':
                case 'float':
                case 'int':
                    if (definition.joinWith) {
                        val = (value === null || +value === -1) ? null : +value;
                    } else {
                        val = +value;
                    }
                    break;
                case 'date':
                    if (_.isDate(value) || _.isString(value)) {
                        val = "'" + moment(value).format(Constants.MYSQL_DATEFORMAT) + "'";
                    }
                    break;
                case 'boolean':
                    val = (value === true);
                    break;
                default:
                    val = (value === null) ? null : "'" + value + "'";
            }
            return val;
        },
        internalize: function (o) {
            const obj = {};
            _.each(_.keys(o), (key) => {
                const field = _.find(this.getFieldDefinitions(), {field: key});
                if (field && !field.nonPersistent) {
                    if (field.type === 'obj_array' && field.model) {
                        const m = require('./' + field.model);
                        obj[field.column] = [];
                        _.each(o[key], (cObj) => {
                            const converted = m.internalize(cObj);
                            obj[field.column].push(converted);
                        });
                    } else {
                        let val = o[key];
                        if (field.type === 'string' && val && val.replace) {
                            val = val.replace(/'/g, "''"); // escape apostrophe
                        }
                        obj[field.column] = val;

                    }
                }
            });
            return obj;
        },
        getField: function (o, column) {
            if (column) {
                return _.find(this.getFieldDefinitions(), {column: o});
            } else {
                return _.find(this.getFieldDefinitions(), {field: o});
            }
        },
        merge: function (cur, orig) {
            _.each(_.keys(orig), (key) => {
                if (cur[key] === undefined && orig[key] !== undefined) {
                    cur[key] = orig[key];
                } else if (_.isArray(cur[key])) {
                    const field = this.getField(key, true);
                    if (field.type === "obj_array" && field.model) {
                        for (let i = 0; i < orig[key].length; i++) {
                            const mergeSource = orig[key][i];
                            const mergeChild = _.find(cur[key], {ID: mergeSource.ID});
                            if (mergeChild) {
                                require('./' + field.model).merge(mergeChild, mergeSource);
                            } else {
                                cur[key].push(mergeSource);
                            }
                        }
                    }
                }
            });
            return cur;
        },
        externalize: function (o) {
            const obj = _.clone(o);
            try {
                if (!o) {
                    return;
                }

                _.each(_.keys(o), (key) => {
                    const field = _.find(this.getFieldDefinitions(), {column: key});
                    if (!field || (field.internal) || (typeof field.externalizeOnEmpty !== 'undefined' && field.externalizeOnEmpty === false && o[key] === null)) {
                        delete obj[key];
                    } else if (field.type === "obj_array") {
                        const children = obj[key];
                        const childDef = require('./' + field.model);
                        obj[field.field] = [];
                        _.each(children, (child) => {
                            const c = childDef.externalize(child);
                            obj[field.field].push(c);
                        });
                        delete obj[key];
                    } else {
                        let val = obj[key];
                        delete obj[key];
                        switch (field.type) {
                            case 'boolean':
                                val = (!_.isBoolean(val)) ? (val === 1) : val;
                                break;
                            case 'date':
                                if (_.isDate(val) || _.isString(val)) {
                                    val = moment(val).format('YYYY-MM-DDTHH:mm:ss.SSSZ');
                                } else {
                                    logger.warn("object with id " + o.ID + " has invalid date: " + val);
                                }
                                break;
                        }
                        obj[field.field] = val;

                    }
                });
            } catch (err) {
                logger.error(err);
            }

            return obj;
        },
        /**
         * Will attempt to resolve and handle expressions that are not resolvable through the columns of the object
         * directly.  An example would be stampCollectionRef from stamps/ownerships.  A subselect is needed on the
         * Albums table to resolve this.  Should return null if the expression is not resolvable.
         *
         * @param key
         * @param op
         * @param value
         * @returns {string}
         */
        // eslint-disable-next-line no-unused-vars
        getSpecialExpression: (key, op, value) => null,
        getFieldDefinitions: function () {
            throw new Error("getFieldDefinitions() needs to implemented by provider.");
        },
        getSequenceColumn: function () {
            throw new Error("getSequenceColumn() needs to be implemented by provider.");
        },
        getTableName: function () {
            throw new Error("getTableName() needs to be implemented by provider.");
        },
        getAlias: function () {
            throw new Error("getAlias() needs to be implemented by provider.");
        },
        getTableClause: function () {
            return this.getTableName() + ' AS ' + this.getAlias();
        }
    };
};

module.exports = new fieldDefinition();