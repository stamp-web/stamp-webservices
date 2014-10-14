var _ = require('../../lib/underscore/underscore');

var fieldDefinition = function () {
    
    return {
        toExternal: function (c) {
            var val = _.findWhere(this.getFieldDefinitions(), { column: c });
            return (val) ? val.field: undefined;
        },
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
            var valid = true;
            _.each(this.getFieldDefinitions(), function (definition) {
                if (definition.required === true) {
                    if (!obj[definition.field]) {
                        valid = false;
                    }
                }
            });
            return valid;
        },
        internalize: function (o) {
            var obj = {};
            var that = this;
            _.each(_.keys(o), function (key) {
                var field = _.findWhere(that.getFieldDefinitions(), { field: key });
                if (field) {
                    obj[field.column] = o[key];
                }
            });
            return obj;
        },
        merge: function (cur, orig) {
            _.each(_.keys(orig), function (o) {
                if (cur[o] === undefined && orig[o] !== undefined) {
                    cur[o] = orig[o];
                } else if (_.isArray(cur[o])) {
                    cur[o] = orig[o];
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
                            val = (!_.isBoolean(val)) ? ((val === 1) ? true : false) : val;
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
        }
    };
};

module.exports = new fieldDefinition();