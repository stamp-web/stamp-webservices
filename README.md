# stamp-webservices

## Required Tools
* NodeJS - (2023-01-02) updated to use promises so version 8.0+ is required
* MySQL Database (or MariaDB) - If using MySQL 8+ and there are problems logging in see troubleshooting below
 

## Configuring the system
While many parameters can be passed on the command line to the server, it is recommended to utilize config/application.json to store 
the properties of the system.  An example file config/application-example.json is provided to give an idea of the flavor of configuration.

### Users file
By default if basic authentication is used, a file config/users.json is leveraged to obtain user information.  This file can be located anywhere and set using the --password_file argument on server startup.  The file is expected to be a simple JSON array of users defined as a (id,username,password).
 
## Initialize Database Tables
The database tables reflecting the schema of the application are available in the script "create-tables.sql".  You should be able to execute this
against a new schema and it will create all the tables, constraints and triggers necessary.


## Logging

The following are the logger names supports by stamp-webservices
  * server - server related messages (INFO default)
  * connection - MySQL related connection messages (INFO default)
  * sql - MySQL query related messages displaying the actual statements (INFO default)

The logging levels can be set for both the tests and server at execution time with a command line argument.  The format is as follows:

```shell
--[loggerName]_level [all|error|warn|info|debug|trace]
```

As well, a small web-service is available to toggle this on the fly under the path /config/loggers/[loggerName]?level=debug

You can disable any console logging using the parameter

```shell
 --silenceConsole
```

## Executing Tests

The tests use jest to execute.  The tests are designed to exercise the REST API end point so must be run in a serial fashion.  
Since stamp models can be dependent on other models and create foreign key references in the database, we can only run 
one test at a time. This can be done with jest with the --runInBand flag.  To execute the tests run

```shell
npm test
```

Or if create a Jest runner in your IDE be sure to add the --runInBand flag.

Some of the tests (especially the web-service tests) may take longer than the 5000ms maximum time that jest imposes by default 
to execute a test and commit done.  The test timeout is set in the jest.config.js file to 10000 (10s) by default. This
can be set on the command line with 

```shell
jest --runInBand --testTimeout 25000 --sql_level error
```

In the above example we also set the sql logger to error instead of info level.

By default, the integration tests will look for a database in application.json called "test".  
This can be overridden using the test_database parameter.  The parameters recognized by the integration tests include:

  * --port xxxx (default is 9002) - the port to execute the forked NodeJS server.
  * --hostname xxxx (default is localhost) - the hostname to connect to the server 
  * --test_database xxxx (default is test) - the database (in application.json) to use for registering the test NodeJS server.
  * --sql_level xxxx - the SQL tracing level

## Running the Server

The server uses a clustered domain to execute multiple threads bound to the same TCPIP port.  By default the server will start on thread per OS reported CPU.  This can be overridden at startup using the --cpu flag described below.

### Executing a single threaded server (useful for testing/debugging etc.)

To execute the single threaded server, run the following command:

  * node app/server/server.js [options]

### Executing the multi-threaded cluster server

  * node app/server/server-manager.js [options]

The following are the supported options:

  * --cpu x (only applies to server-manager) - the number of CPU threads to start
  * --port xxxx - The port to bind the HTTP server to
  * --basePath xxxx - The "web-app" name to use for the server (defaults to "stamp-webservices")
  * --xxx_logger yyy - set the logger xxx to level yyy
  * --database xxx - the named database defined in config/application.json
  * --db_password xxx - the password to use for the database connection if not defined in the application.json and prompt is undesired.
  * --authentication xxx - the authentication scheme to use (currently supported as "none" or "basic")
  * --password_file xxx - the authentication users file (for basic authentication) (defaults to "config/users.json")
  * --httpOnly - will run the server as HTTP even when HTTPS certificates are configurated

### Configuring HTTPS

Obtain a certificate for your application.  Edit the file config/application.json and add the section "Certificates" with
child key values of "CertificateFile" and "CertificateKeyFile" both pointing to the location of the .crt and .key files 
respectfully.  The server will automatically startup in HTTPS mode unless the flag "--httpOnly" has been set.

See application-example.json for the configuration format.


## Code Coverage

The code coverage will be reported in the coverage folder in the project root.  These values will be unreliable due to the
nature of the tests execute rest APIs against a forked server process initialized for each test.  Since the server process
is not running in the jest process stack it does not get picked up for code coverage purposes.

## Execution in CI and Jenkins

To run the tests in CI, the server must be accessible to the Jenkins process.  If an environment variable is set for ``port`` this will
be used to connect to the server with HTTP API requests.

## Troubleshooting

### MySQL 8+ Changes and Impacts
* Prior to MySQL 8+, the users had passwords using mysql_native_password.  Starting in MySQL 8+ they will be created using "caching_sha2_password".  In order to modify the user password to the compatible "mysql_native_password" use the following (see [Issue 64](https://github.com/stamp-web/stamp-webservices/issues/65)):
 ```ALTER USER myuser IDENTIFIED WITH mysql_native_password BY 'mypassword';```
* In MySQL 8+, the default sql_mode is now set to ``ONLY_FULL_GROUP_BY`` which means any ORDER BY requires all referenced columns need to be included see [Issue 64](https://github.com/stamp-web/stamp-webservices/issues/64) 