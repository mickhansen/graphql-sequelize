'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Sequelize = require('sequelize')
  , attributeFields = require('../../src/attributeFields');

import { sequelize } from '../support/helper'

import argsToFindOptions from "../../src/argsToFindOptions";


describe("order options", ()=> {
  let sequalizeOrder = {
    order: [['name','ASC']]
  }

  it("preserve order args as sequalize-like order options array", ()=> {
    let result = argsToFindOptions(sequalizeOrder, [])
    expect(result).to.eql(sequalizeOrder)
  });

  it("order args as simple string adds sort direction", ()=> {

    let args = { order: 'name' }

    let result = argsToFindOptions(args, [])
    expect(result).to.eql(sequalizeOrder)
  });

});
