'use strict';

var chai = require('chai')
  , expect = chai.expect
  , defaultListArgs = require('../src/defaultListArgs');

import {
  GraphQLString,
  GraphQLInt
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
});