'use strict';

var Sequelize = require('sequelize')
  , Helper = {};

Helper.sequelize = new Sequelize(null, null, null, {
  dialect: 'sqlite',
  logging: false
});

beforeEach(function () {
  this.sequelize = Helper.sequelize;
});

Helper.Promise = Sequelize.Promise;

module.exports = Helper;