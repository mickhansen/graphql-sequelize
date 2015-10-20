'use strict';

var chai = require('chai')
  , expect = chai.expect
  , helper = require('./helper')
  , sequelize = helper.sequelize
  , Sequelize = require('sequelize')
  , attributeFields = require('../../src/attributeFields');

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLList
} from 'graphql';

import {
  toGlobalId
} from 'graphql-relay';

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
        type: Sequelize.ENUM('foo_bar', 'foo-bar')
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

  it('should be possible to rename fields with map', function () {
    var fields = attributeFields(Model, {
      map: {
        id: '_id'
      }
    });

    expect(Object.keys(fields)).to.contain('_id');
    expect(Object.keys(fields)).not.to.contain('id');
  });

  it('should be possible to automatically set a relay globalId', function () {
    var fields = attributeFields(Model, {
      globalId: true
    });

    expect(fields.id.resolve).to.be.ok;
    expect(fields.id.type.ofType.name).to.equal('ID');
    expect(fields.id.resolve({
      id: 23
    })).to.equal(toGlobalId(Model.name, 23));
  });

  it('should automatically name enum types', function () {
    var fields = attributeFields(Model);

    expect(fields.enum.type.name).to.not.be.undefined;
    expect(fields.enumTwo.type.name).to.not.be.undefined;

    expect(fields.enum.type.name).to.equal(modelName + 'enum' + 'EnumType');
    expect(fields.enumTwo.type.name).to.equal(modelName + 'enumTwo' + 'EnumType');
  });

  it('should support enum values with characters not allowed by GraphQL', function () {
    var fields = attributeFields(Model);

    expect(fields.enumTwo.type.getValues()).to.not.be.undefined;
    expect(fields.enumTwo.type.getValues()[1].name).to.equal('fooBar');
    expect(fields.enumTwo.type.getValues()[1].value).to.equal('foo-bar');
  });

  it('should support enum values with underscores', function () {
    var fields = attributeFields(Model);

    expect(fields.enumTwo.type.getValues()).to.not.be.undefined;
    expect(fields.enumTwo.type.getValues()[0].name).to.equal('foo_bar');
    expect(fields.enumTwo.type.getValues()[0].value).to.equal('foo_bar');
  });
});
