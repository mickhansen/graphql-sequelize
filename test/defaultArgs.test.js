'use strict';

var chai = require('chai')
  , expect = chai.expect
  , helper = require('./helper')
  , sequelize = helper.sequelize
  , Sequelize = require('sequelize')
  , defaultArgs = require('../src/defaultArgs');

import {
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull
} from 'graphql';

describe('defaultArgs', function () {
  it('should return a key for a integer primary key', function () {
    var Model
      , args;

    Model = sequelize.define(Math.random().toString(), {});

    args = defaultArgs(Model);

    expect(args).to.have.ownProperty('id');
    expect(args.id.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(args.id.type.ofType).to.equal(GraphQLInt);
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

    expect(args.modelId.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(args.modelId.type.ofType).to.equal(GraphQLString);
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

    expect(args.uuid.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(args.uuid.type.ofType).to.equal(GraphQLString);
  });
});