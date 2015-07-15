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
  GraphQLNonNull
} from 'graphql';

describe('attributeFields', function () {
  it('should return fields for a simple model', function () {
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
      }
    }, {
      timestamps: false
    });

    var fields = attributeFields(Model);

    expect(Object.keys(fields)).to.deep.equal(['id', 'email', 'firstName', 'lastName']);

    expect(fields.id.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(fields.id.type.ofType).to.equal(GraphQLInt);

    expect(fields.email.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(fields.email.type.ofType).to.equal(GraphQLString);

    expect(fields.firstName.type).to.equal(GraphQLString);

    expect(fields.lastName.type).to.equal(GraphQLString);
  });
});