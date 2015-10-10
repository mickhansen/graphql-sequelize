'use strict';

var chai = require('chai')
  , expect = chai.expect
  , helper = require('./helper')
  , sequelize = helper.sequelize
  , Sequelize = require('sequelize')
  , attributeFields = require('../src/attributeFields');

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLList
} from 'graphql';

describe('attributeFields', function () {
  var Model;
  var modelName = Math.random().toString();
  before(function () {
    Model = sequelize.define(modelName, {
      email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      firstName: {
        type: Sequelize.STRING
      },
      lastName: {
        type: Sequelize.STRING
      },
      float: {
        type: Sequelize.FLOAT
      },
      enum: {
        type: Sequelize.ENUM('first', 'second')
      },
      enumTwo: {
        type: Sequelize.ENUM('first', 'second')
      },
      list: {
        type: Sequelize.ARRAY(Sequelize.STRING)
      },
      virtualInteger: {
        type: new Sequelize.VIRTUAL(Sequelize.INTEGER)
      },
      virtualBoolean: {
        type: new Sequelize.VIRTUAL(Sequelize.BOOLEAN)
      }
    }, {
      timestamps: false
    });
  });

  it('should return fields for a simple model', function () {
    var fields = attributeFields(Model);

    expect(Object.keys(fields)).to.deep.equal(['id', 'email', 'firstName', 'lastName', 'float', 'enum', 'enumTwo', 'list', 'virtualInteger', 'virtualBoolean']);

    expect(fields.id.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(fields.id.type.ofType).to.equal(GraphQLInt);

    expect(fields.email.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(fields.email.type.ofType).to.equal(GraphQLString);

    expect(fields.firstName.type).to.equal(GraphQLString);

    expect(fields.lastName.type).to.equal(GraphQLString);

    expect(fields.enum.type).to.be.an.instanceOf(GraphQLEnumType);

    expect(fields.enumTwo.type).to.be.an.instanceOf(GraphQLEnumType);

    expect(fields.list.type).to.be.an.instanceOf(GraphQLList);

    expect(fields.float.type).to.equal(GraphQLFloat);

    expect(fields.virtualInteger.type).to.equal(GraphQLInt);

    expect(fields.virtualBoolean.type).to.equal(GraphQLBoolean);
  });

  it('should be possible to exclude fields', function () {
    var fields = attributeFields(Model, {
      exclude: ['id', 'email', 'float', 'enum', 'enumTwo', 'list', 'virtualInteger', 'virtualBoolean']
    });

    expect(Object.keys(fields)).to.deep.equal(['firstName', 'lastName']);
  });

  it('should be possible to specify specific fields', function () {
    var fields = attributeFields(Model, {
      only: ['id', 'email', 'list']
    });

    expect(Object.keys(fields)).to.deep.equal(['id', 'email', 'list']);
  });

  it('should automatically name enum types', function () {
    var fields = attributeFields(Model);

    expect(fields.enum.type.name).to.not.be.undefined;
    expect(fields.enumTwo.type.name).to.not.be.undefined;

    expect(fields.enum.type.name).to.equal(modelName + 'enum' + 'EnumType');
    expect(fields.enumTwo.type.name).to.equal(modelName + 'enumTwo' + 'EnumType');
  });
});
