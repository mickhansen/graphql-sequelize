'use strict';

var Sequelize = require('sequelize')
  , Helper = {}
  , dialect = process.env.DB_PORT_5432_TCP_ADDR ? 'postgres' : 'sqlite'
  , host = dialect === 'postgres' ? process.env.DB_PORT_5432_TCP_ADDR : null
  , user = dialect === 'postgres' ? 'graphql_sequelize_test' : null 
  , database = dialect === 'postgres' ? 'graphql_sequelize_test' : null 
  , password = dialect === 'postgres' ? 'graphql_sequelize_test' : null;

Helper.sequelize = new Sequelize(database, user, password, {
  host: host,
  dialect: dialect,
  logging: false
});

before(function () {
  this.sequelize = Helper.sequelize;
});

Helper.Promise = Sequelize.Promise;

module.exports = Helper;