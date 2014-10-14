var url = require('url');

var routeHelper = function () {
    return {
        StatusCode : {
            OK: 200,
            CREATED: 201,
            NO_CONTENT: 204,
            BAD_REQUEST: 400,
            NOT_FOUND: 404,
            CONFLICT: 409,
            INTERNAL_ERROR: 500
        },
        ClientMessages: {
            INTERNAL_ERROR: "An unexpected error occured on the server."
        }, 
        ContentType : {
            JSON: "application/json",
            TEXT: "text/plain"
        }, 
        Headers : {
            CONTENT_TYPE: "Content-Type"
        }, 
        findIdFromPath : function (urlPath) {
            var path = url.parse(urlPath).pathname;
            var last = path.lastIndexOf("/");
            var id = +path.substring(path.lastIndexOf('/') + 1);
            return id;
        }, 
        setErrorStatus : function (res, err) {
            var code = this.StatusCode.INTERNAL_ERROR;
            switch (err.code) {
                case "UNIQUENESS_EXCEPTION":
                    code = this.StatusCode.CONFLICT;
                    break;
                case "REQUIRED_FIELD":
                    code = this.StatusCode.BAD_REQUEST;
                    break;
                case "NOT_FOUND":
                    code = this.StatusCode.NOT_FOUND;
                    break;
            }
            res.status(code).send(err.message);
        }
    }
};


module.exports = new routeHelper();