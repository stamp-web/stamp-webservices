# stamp-webservices


## Configuring the system
While many parameters can be passed on the command line to the server, it is recommended to utilize config/application.json to store 
the properties of the system.  An example file config/application-example.json is provided to give an idea of the flavor of configuration.


## Initialize Database Tables
The database tables reflecting the schema of the application are available in the script "create-tables.sql".  You should be able to execute this
against a new schema and it will create all the tables, constraints and triggers necessary.


## Logging

The following are the logger names supports by stamp-webservices
  * server - server related messages (INFO default)
  * connection - MySQL related connection messages (INFO default)
  * sql - MySQL query related messages displaying the actual statements (INFO default)

The logging levels can be set for both the tests and server at execution time with a command line argument.  The format is as follows:

  * --[loggerName]_level=[all|error|warn|info|debug|trace]
  
As well, a small web-service is available to toggle this on the fly under the path /config/loggers/[loggerName]?level=debug

## Executing Tests

Some of the tests (especially the web-service tests) may take longer than the 2000ms maximum time that mocha imposes by default to execute a test and commit done.  The following settings have worked reasonable well on my development system:

  * mocha test --timeout 6000 --sql_level error

by changing the sql_level you can quickly toggle the tests to use a different logging level.

By default, the integration tests will look for a database in application.json called "test".  This can be overridden using the test_database parameter.  The parameters recognized by the integration tests include:

  * --port xxxx (default is 9002) - the port to execute the forked NodeJS server.
  * --hostname xxxx (default is localhost) - the hostname to connect to the server 
  * --test_database xxxx (default is test) - the database (in application.json) to use for registering the test NodeJS server.
  * --sql_level xxxx - the SQL tracing level
  
## Code Coverage
istanbul cover <path to mocha>\bin\_mocha
