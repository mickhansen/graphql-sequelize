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
  GraphQLNonNull
} from 'graphql';

describe('attributeFields', function () {
  var Model = sequelize.define(Math.random().toString(), {
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
    }
  }, {
    timestamps: false
  });

  it('should return fields for a simple model', function () {
    var fields = attributeFields(Model);

    expect(Object.keys(fields)).to.deep.equal(['id', 'email', 'firstName', 'lastName', 'float']);

    expect(fields.id.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(fields.id.type.ofType).to.equal(GraphQLInt);

    expect(fields.email.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(fields.email.type.ofType).to.equal(GraphQLString);

    expect(fields.firstName.type).to.equal(GraphQLString);

    expect(fields.lastName.type).to.equal(GraphQLString);

    expect(fields.float.type).to.equal(GraphQLFloat);
  });

  it('should be possible to exclude fields', function () {
    var fields = attributeFields(Model, {
      exclude: ['id', 'email', 'float']
    });

    expect(Object.keys(fields)).to.deep.equal(['firstName', 'lastName']);
  });
});
