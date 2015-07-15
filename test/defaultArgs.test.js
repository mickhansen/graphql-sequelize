'use strict';

var chai = require('chai')
  , expect = chai.expect
  , helper = require('./helper')
  , sequelize = helper.sequelize
  , Sequelize = require('sequelize')
  , defaultArgs = require('../src/defaultArgs');

import {
  GraphQLString,
  GraphQLInt
} from 'graphql';

describe('defaultArgs', function () {
  it('should return a key for a integer primary key', function () {
    var Model
      , args;

    Model = sequelize.define(Math.random().toString(), {});

    args = defaultArgs(Model);

    expect(args).to.have.ownProperty('id');
    expect(args.id.type).to.equal(GraphQLInt);
  });

  it('should return a key for a string primary key', function () {
    var Model
      , args;

    Model = sequelize.define(Math.random().toString(), {
      modelId: {
        type: Sequelize.STRING,
        primaryKey: true
      }
    });

    args = defaultArgs(Model);

    expect(args).to.have.ownProperty('modelId');
    expect(args.modelId.type).to.equal(GraphQLString);
  });

  it('should return a key for a string primary key', function () {
    var Model
      , args;

    Model = sequelize.define(Math.random().toString(), {
      uuid: {
        type: Sequelize.UUID,
        primaryKey: true
      }
    });

    args = defaultArgs(Model);

    expect(args).to.have.ownProperty('uuid');
    expect(args.uuid.type).to.equal(GraphQLString);
  });
});