let extend = require('node.extend');
let PersistentCollection = require('./persistent-collection');
let connectionManager = require('../pom/connection-mysql');
let dataTranslator = require('./mysql-translator');
let stamp = require('../model/stamp');
let catalogueNumberHelper = require('../model/catalogue-number-helper');
let ownership = require('../model/ownership');
let catalogueNumber = require('../model/catalogue-number');
let catalogue = require('../model/catalogue');
let country = require('../model/country');
let catalogues = require('./catalogues');
let _ = require('lodash');

let Logger = require('../util/logger');


let stamps = extend(true, {}, new PersistentCollection(), function () {
    "use strict";

    let sqlTrace = Logger.getLogger("sql");

    function generateColumnExpression(fields, tableRef,distinct) {
        let s = "";
        _.each(fields, function (field, indx) {
            let c = tableRef + "." + field.column;
            if( distinct === true && field.column === 'ID' ) {
                c = "DISTINCT(" + c + ")";
            }
            s += c;
            if (indx < fields.length - 1) {
                s += ',';
            }
        });
        return s;
    }

    function populateKey(stamp, k) {
        if (!_.has(stamp, k)) {
            stamp[k] = [];
        }
    }

    function processRow(rows, row, fieldDef, key) {
        let s = _.find(rows, { ID: row.STAMP_ID });
        if (!s) {
            sqlTrace.trace("No stamp found for " + row.STAMP_ID);
            return;
        }
        s[key].push(row);
    }

    function getFromTableForChildren (fieldDefinition) {
        let tables = stamp.getTableName() + ' AS ' + stamp.getAlias() + ' JOIN ' + fieldDefinition.getTableName() + ' AS ' + fieldDefinition.getAlias();
        tables += ' ON ' + stamp.getAlias() + '.ID=' + fieldDefinition.getAlias() + '.STAMP_ID';
        return tables;
    }

    function generateChildSelection(supportedFields, fieldDefinition, inValues) {
        let select = 'SELECT ' + generateColumnExpression(supportedFields, fieldDefinition.getAlias());
        select += ' FROM ' + getFromTableForChildren(fieldDefinition) + ' WHERE ' + fieldDefinition.getAlias() + '.STAMP_ID IN ' + inValues;
        return select;
    }

    let cachePolicy = true;

    const getCatalogues = () => {
        return catalogues.find();
    }

    return {

        setCachePolicy: val => {
            cachePolicy = val;
        },

        preCommitUpdate: async function (connection, merged, storedObj) {
            let catalogues = (await getCatalogues()).rows;
            return new Promise((resolve, reject) => {
                let updateList = [], createList = [];
                let parseChildren = (childName, fieldDef) => {
                    if (merged[childName] && _.isArray(merged[childName])) {
                        _.each(merged[childName], obj => {
                            if (obj.ID) {
                                let current = _.find(storedObj[childName], {ID: obj.ID});
                                if (childName === 'CATALOGUENUMBER') {
                                    obj.NUMBERSORT = catalogueNumberHelper.serialize(obj, catalogues);
                                }
                                let sql = dataTranslator.generateUpdateByFields(fieldDef, obj, current, true);
                                if (sql !== null) {
                                    updateList.push(sql);
                                }
                            } else {
                                obj.STAMP_ID = merged.ID;
                                if (childName === 'CATALOGUENUMBER') {
                                    obj.NUMBERSORT = catalogueNumberHelper.serialize(obj, catalogues);
                                }
                                createList.push({fieldDefinition: fieldDef, object: obj});
                            }
                        });
                    }
                };
                parseChildren("CATALOGUENUMBER", catalogueNumber);
                parseChildren("OWNERSHIP", ownership);

                let total = updateList.length + createList.length;
                let count = 0;
                let resolveWhenFinished = () => {
                    if (count === total) {
                        resolve({
                            modified: total > 0
                        });
                    }
                };
                resolveWhenFinished();
                _.each(updateList, function (sql) {
                    sqlTrace.debug(sql);
                    connection.query(sql, function (err, data) {
                        if (err !== null) {
                            reject(dataTranslator.getErrorMessage(err));
                        } else {
                            count++;
                            resolveWhenFinished();
                        }

                    });
                });
                _.each(createList, function (obj) {
                    let creating = obj;
                    PersistentCollection.getNextSequence(creating.fieldDefinition, (err, id) => {
                        if (err !== null) {
                            reject(dataTranslator.getErrorMessage(err));
                        } else {
                            creating.object.ID = id;
                            let c_sql = dataTranslator.generateInsertByFields(creating.fieldDefinition, creating.object);
                            sqlTrace.debug(c_sql);
                            connection.query(c_sql, (err, data) => {
                                if (err !== null) {
                                    reject(dataTranslator.getErrorMessage(err));
                                } else {
                                    count++;
                                    resolveWhenFinished();
                                }
                            });
                            PersistentCollection.updateSequence(id, creating.fieldDefinition);
                        }
                    });
                });
            });
        },

        preCreate: async provided => {
            let catResult = await getCatalogues();
            let cats = catResult.rows;
            if(provided.CATALOGUENUMBER) {
                _.each(provided.CATALOGUENUMBER, cn => {
                    cn.NUMBERSORT = catalogueNumberHelper.serialize(cn, cats);
                });
            }
        },

        postCreate: function (connection, obj) {
            return new Promise((resolve, reject) => {
                let total = ((obj.CATALOGUENUMBER) ? obj.CATALOGUENUMBER.length : 0) + ((obj.OWNERSHIP) ? obj.OWNERSHIP.length : 0);
                let created = 0;
                if (obj.CATALOGUENUMBER && _.isArray(obj.CATALOGUENUMBER)) {
                    _.each(obj.CATALOGUENUMBER, catNum => {
                        catNum.STAMP_ID = obj.ID;
                        this.generateId(catalogueNumber, catNum).then(id => {
                            catNum.ID = id;
                            let sql = dataTranslator. generateInsertByFields(catalogueNumber, catNum);
                            sqlTrace.debug(sql);
                            connection.query(sql, (err, result) => {
                                if (err) {
                                    reject(dataTranslator.getErrorMessage(err));
                                } else {
                                    created++;
                                    if (created === total) {
                                        resolve(obj);
                                    }
                                }
                            });
                        }, function (err) {
                            reject(dataTranslator.getErrorMessage(err));
                        });
                    });
                }
                if (obj.OWNERSHIP && _.isArray(obj.OWNERSHIP)) {
                    _.each(obj.OWNERSHIP, owner => {
                        owner.STAMP_ID = obj.ID;
                        this.generateId(ownership, owner).then(id => {
                            owner.ID = id;
                            let sql = dataTranslator. generateInsertByFields(ownership, owner);
                            sqlTrace.debug(sql);
                            connection.query(sql, (err, result) => {
                                if (err) {
                                    reject(dataTranslator.getErrorMessage(err));
                                } else {
                                    created++;
                                    if (created === total) {
                                        resolve(obj);
                                    }
                                }

                            });
                        });
                    }, function (err) {
                        reject(dataTranslator.getErrorMessage(err));
                    });
                }
            });
        },

        getFromTables: function (params) {
            let tables = stamp.getTableName() + ' AS ' + stamp.getAlias() + ' JOIN ' + catalogueNumber.getTableName() + ' AS ' + catalogueNumber.getAlias();
            tables += ' ON ' + stamp.getAlias() + '.ID=' + catalogueNumber.getAlias() + '.STAMP_ID ';
            tables += 'LEFT JOIN ' + ownership.getTableName() + ' AS ' + ownership.getAlias() + ' ON ' + stamp.getAlias() + '.ID = ' + ownership.getAlias() + '.STAMP_ID';
            if( params.$orderby ) {
                let orderby = params.$orderby;
                /*if( orderby.indexOf('number') > -1) {
                    tables += ' LEFT JOIN ' + catalogue.getTableName() + ' AS ' + catalogue.getAlias() + ' ON ' + catalogueNumber.getAlias() + '.CATALOGUE_REF=' + catalogue.getAlias() + '.ID';
                } else*/ if( orderby.indexOf('countryRef') > -1) {
                    tables += ' LEFT JOIN ' + country.getTableName() + ' AS ' + country.getAlias() + ' ON ' + stamp.getAlias() + '.COUNTRY_ID=' + country.getAlias() + '.ID';
                }
            }
            return tables;
        },

        getWhereClause: function (params) {
            let clause = (params && params.$filter) ? dataTranslator.toWhereClause(params.$filter, [stamp, catalogueNumber, ownership]) : '';
            if( clause.length > 0 ) {
                clause += ' AND ' + catalogueNumber.getAlias() + '.ACTIVE=1';
            }
            return clause;
        },

        find: async function (params) {
            let count = await this.count({});
            if (count === 0) {
                return Promise.resolve({total:0, rows:[]});
            }
            return new Promise((resolve, reject) => {
                let rejectFn = function (field) {
                    return (field.internal && field.internal === true && field.required !== true || field.model);
                };
                let stampDef = _.reject(stamp.getFieldDefinitions(), rejectFn);
                let catDef = _.reject(catalogueNumber.getFieldDefinitions(), rejectFn);
                let ownerDef = _.reject(ownership.getFieldDefinitions(), rejectFn);

                let select = 'SELECT SQL_CALC_FOUND_ROWS ' + generateColumnExpression(stampDef, stamp.getAlias(),true) + ' FROM ' + this.getFromTables(params);
                let whereClause = this.getWhereClause(params);
                let orderby = this.getOrderByClause(params, [stamp, ownership, catalogueNumber]);
                select += ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '') + ' ' + orderby + ' LIMIT ' + params.$offset + ',' + params.$limit;
                sqlTrace.debug(select);
                let t = (new Date()).getTime();
                connectionManager.getConnection().then(connection => {
                    let query = connection.query(select, (err, stamps) => {
                        if (err) {
                            connection.release();
                            reject(dataTranslator.getErrorMessage(err));
                        } else {
                            connection.query("SELECT FOUND_ROWS() AS ROWCOUNT", (err, countData) => {
                                if (err) {
                                    connection.release();
                                    reject(dataTranslator.getErrorMessage(err));
                                } else {
                                    let result = {
                                        rows: stamps,
                                        total: countData[0].ROWCOUNT
                                    };
                                    if (result.total === 0) {
                                        connection.release();
                                        resolve(result);
                                    } else {
                                        let ids = [];
                                        _.each(result.rows, row => {
                                            populateKey(row,'CATALOGUENUMBER');
                                            populateKey(row,'OWNERSHIP');
                                            ids.push(row.ID);
                                        });
                                        let inValues = dataTranslator.generateInValueStatement(ids);
                                        let queries = [
                                            {
                                                sql: generateChildSelection(catDef, catalogueNumber, inValues),
                                                fieldDefinition: catalogueNumber,
                                                collectionKey: 'CATALOGUENUMBER'
                                            },
                                            {
                                                sql: generateChildSelection(ownerDef, ownership, inValues),
                                                fieldDefinition: ownership,
                                                collectionKey: 'OWNERSHIP'
                                            }
                                        ];
                                        let completed = 0;
                                        let toExecute = queries.length;
                                        _.each(queries, query => {
                                            sqlTrace.debug(query.sql);
                                            let _query = connection.query(query.sql);
                                            _query.on('result', row => {
                                                processRow(result.rows, row, query.fieldDefinition, query.collectionKey);
                                            }).on('end', () => {
                                                completed++;
                                                if (completed === toExecute) {
                                                    connection.release();
                                                    sqlTrace.info("Time to query and process rows: " + (new Date().getTime() - t) + "ms");
                                                    resolve(result);
                                                }
                                            }).on('error', err => {
                                                connection.release();
                                                reject(dataTranslator.getErrorMessage(err));
                                            });
                                        });
                                    }
                                }
                            });
                        }
                    });
                }, function (err) {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });
        },
        collectionName: 'stamps',
        fieldDefinition: stamp
    };
}());

module.exports = stamps;
