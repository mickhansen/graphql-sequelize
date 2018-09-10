'use strict';


import {expect} from 'chai';
import Sequelize from 'sequelize';
import defaultArgs from '../../src/defaultArgs';
import DateType from '../../src/types/dateType';

import { sequelize } from '../support/helper';

import {
  GraphQLString,
  GraphQLInt,
  GraphQLScalarType
} from 'graphql';

describe('defaultArgs', function () {
  it('should return a key for a integer primary key', function () {
    var Model
      , args;

    Model = sequelize.define('DefaultArgModel', {});

    args = defaultArgs(Model);

    expect(args).to.have.ownProperty('id');
    expect(args.id.type).to.equal(GraphQLInt);
  });

  it('should return a key for a string primary key', function () {
    var Model
      , args;

    Model = sequelize.define('DefaultArgModel', {
      modelId: {
        type: Sequelize.STRING,
        primaryKey: true
      }
    });

    args = defaultArgs(Model);

    expect(args.modelId.type).to.equal(GraphQLString);
  });

  it('should return a key for a UUID primary key', function () {
    var Model
      , args;

    Model = sequelize.define('DefaultArgModel', {
      uuid: {
        type: Sequelize.UUID,
        primaryKey: true
      }
    });

    args = defaultArgs(Model);

    expect(args.uuid.type).to.equal(GraphQLString);
  });

  it('should return multiple keys for a compound primary key', function () {
    var Model
      , args;

    Model = sequelize.define('UserHistory', {
      userId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
      },
      timestamp: {
        type: Sequelize.DATE,
        primaryKey: true,
      },
    });

    args = defaultArgs(Model);

    expect(args.userId.type).to.equal(GraphQLInt);
    expect(args.timestamp.type).to.equal(DateType);
  });

  describe('will have an "where" argument', function () {

    it('that is an GraphQLScalarType', function () {
      var Model
        , args;

      Model = sequelize.define('DefaultArgModel', {
        modelId: {
          type: Sequelize.STRING,
          primaryKey: true
        }
      });

      args = defaultArgs(Model);

      expect(args).to.have.ownProperty('where');
      expect(args.where.type).to.be.an.instanceOf(GraphQLScalarType);
    });

  });


});
