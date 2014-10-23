var _ = require('../../lib/underscore/underscore');
var Constants = require('../util/constants');

var fieldDefinition = function () {
    "use strict";
    return {
        toInternal: function (f) {
            var val = _.findWhere(this.getFieldDefinitions(), { field: f });
            return (val) ? val.column: undefined;
        },
        /**
         * Validate whether the required fields are all provided in the object 
         * specified.  This method is used to validate incoming objects for 
         * validity.
         * 
         * @param obj (JsObject) 
         */
        validate: function (obj) {
            var valid = null;
            _.each(this.getFieldDefinitions(), function (definition) {
                if (definition.required === true) {
                    if (!obj[definition.field]) {
                        valid = { code: 'REQUIRED_FIELD', message: 'A value for field \'' + definition.field + '\' is required.', processed: true};
                        return false;
                    }
                }
            });
            return valid;
        },
        formatValue: function(definition, value) {
            if (definition.type === 'id_array' || definition.type === 'obj_array') {
                return undefined;
            }
            var val = null;
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
                    if (_.isDate(value)) {
                        val = "\'" + value.toFormat(Constants.MYSQL_DATEFORMAT) + "\'";
                    } else if (_.isString(value)) {
                        value = new Date(value);
                        val = "\'" + value.toFormat(Constants.MYSQL_DATEFORMAT) + "\'";
                    }
                    break;
                case 'boolean':
                    val = (value === true);
                    break;
                default:
                    val = (value === null) ? null : "\'" + value + "\'";
            }
            return val;
        },
        internalize: function (o) {
            var obj = {};
            var that = this;
            _.each(_.keys(o), function (key) {
                var field = _.findWhere(that.getFieldDefinitions(), { field: key });
                if (field && !field.nonPersistent) {
                    if (field.type === 'obj_array' && field.model) {
                        var m = require('./' + field.model);
                        obj[field.column] = [];
                        _.each(o[key], function (cObj) {
                            var converted = m.internalize(cObj);
                            obj[field.column].push(converted);
                        });
                    }
                    else {
                        obj[field.column] = o[key];
                    }
                }
            });
            return obj;
        },
        getField: function (o, column) {
            if( column ) {
                return _.findWhere(this.getFieldDefinitions(), { column: o });
            } else {
                return _.findWhere(this.getFieldDefinitions(), { field: o });
            }
        },
        merge: function (cur, orig) {
            var that = this;
            _.each(_.keys(orig), function (key) {
                if (cur[key] === undefined && orig[key] !== undefined) {
                    cur[key] = orig[key];
                } else if (_.isArray(cur[key])) {
                    var field = that.getField(key, true);
                    if (field.type === "obj_array" && field.model) {
                        for (var i = 0; i < orig[key].length; i++) {
                            var mergeSource = orig[key][i];
                            var mergeChild = _.findWhere(cur[key], { ID: mergeSource.ID });
                            if( mergeChild ) {
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
            if (!o) {
                return;
            }
            var obj = _.clone(o);
            var that = this;
            _.each(_.keys(o), function (key) {
                var field = _.findWhere(that.getFieldDefinitions(), { column: key });
                if (!field || (field.internal) || (typeof field.externalizeOnEmpty !== 'undefined' && field.externalizeOnEmpty === false && o[key] === null)) {
                    delete obj[key];
                } else if (field.type === "obj_array") {
                    var children = obj[key];
                    var childDef = require('./' + field.model);
                    obj[field.field] = [];
                    _.each(children, function (child) {
                        var c = childDef.externalize(child);
                        obj[field.field].push(c);
                    });
                    delete obj[key];
                } else {
                    var val = obj[key];
                    delete obj[key];
                    switch (field.type) {
                        case 'boolean':
                            val = (!_.isBoolean(val)) ? (val === 1) : val;
                            break;
                        case 'date':
                            val = val.toFormat("YYYY-MM-DDTHH:MI:SS") + "-05:00";
                            break;
                    }
                    obj[field.field] = val;

                }
            });
            return obj;
        },
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
        }
    };
};

module.exports = new fieldDefinition();