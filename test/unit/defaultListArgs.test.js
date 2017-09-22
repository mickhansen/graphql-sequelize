'use strict';

import {expect} from 'chai';
import Sequelize from 'sequelize';
import defaultListArgs from '../../src/defaultListArgs';

import { sequelize } from '../support/helper';

import {
  GraphQLString,
  GraphQLInt,
  GraphQLScalarType
} from 'graphql';

describe('defaultListArgs', function () {
  it('should return a limit key', function () {
    var args = defaultListArgs();

    expect(args).to.have.ownProperty('limit');
    expect(args.limit.type).to.equal(GraphQLInt);
  });

  it('should return a order key', function () {
    var args = defaultListArgs();

    expect(args).to.have.ownProperty('order');
    expect(args.order.type).to.equal(GraphQLString);
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

      args = defaultListArgs(Model);

      expect(args).to.have.ownProperty('where');
      expect(args.where.type).to.be.an.instanceOf(GraphQLScalarType);
    });

  });

});
