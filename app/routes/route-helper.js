const _ = require('lodash');

const routeHelper = function () {

    return {
        StatusCode: {
            OK: 200,
            CREATED: 201,
            NO_CONTENT: 204,
            BAD_REQUEST: 400,
            NOT_FOUND: 404,
            FORBIDDEN: 403,
            CONFLICT: 409,
            INTERNAL_ERROR: 500
        },
        ClientMessages: {
            INTERNAL_ERROR: "An unexpected error occured on the server."
        },
        ContentType: {
            JSON: "application/json",
            TEXT: "text/plain"
        },
        Headers: {
            CONTENT_TYPE: "Content-Type",
            CONTENT_LENGTH: "Content-Length"
        },
        setErrorStatus: function (res, err) {
            let code = this.StatusCode.INTERNAL_ERROR;
            switch (err.code) {
                case 'UNIQUENESS_EXCEPTION':
                    code = this.StatusCode.CONFLICT;
                    break;
                case 'REQUIRED_FIELD':
                case 'INVALID_OBJECT':
                    code = this.StatusCode.BAD_REQUEST;
                    break;
                case 'NOT_FOUND':
                    code = this.StatusCode.NOT_FOUND;
                    break;
                case 'CONFLICT':
                    code = this.StatusCode.CONFLICT;
                    break;
                case 'FORBIDDEN':
                    code = this.StatusCode.FORBIDDEN;
            }
            res.status(code).send(err.message);
        },
        convertMap: function (results) {
            const obj = [];
            _.forEach(results, function (result) {
                const keys = Object.keys(result);
                const r = {};
                _.forEach(keys, function (key) {
                    r[key.toLowerCase()] = result[key];
                })
                obj.push(r);
            })
            return obj;
        }
    };
};


module.exports = new routeHelper();