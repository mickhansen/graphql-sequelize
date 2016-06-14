'use strict';


import chai, {expect} from "chai";
import Sequelize from "sequelize";
import JSONType from "../../src/types/jsonType";
import defaultArgs from "../../src/defaultArgs";

import { sequelize } from '../support/helper'

import {
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull,
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

  it('should return a key for a string primary key', function () {
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
