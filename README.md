# stamp-webservices

## Configuring the system
While many parameters can be passed on the command line to the server, it is recommended to utilize config/application.json to store 
the properties of the system.  An example file config/application-example.json is provided to give an idea of the flavor of configuration.

## Initialize Database Tables
The database tables reflecting the schema of the application are available in the script "create-tables.sql".  You should be able to execute this
against a new schema and it will create all the tables, constraints and triggers necessary.

istanbul cover <path to mocha>\bin\_mocha