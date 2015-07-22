'use strict';

var chai = require('chai')
  , expect = chai.expect
  , helper = require('./helper')
  , sequelize = helper.sequelize
  , Sequelize = require('sequelize')
  , parser = parse = require('graphql/lib/language/parser').parse
  , parse = function (query) {
      return parser(query).definitions[0];
    }
  , simplifyAST = require('../src/simplifyAST');

describe('simplifyAST', function () {
  it('should simplify a basic nested structure', function () {
    expect(simplifyAST(parse(`
      {
        users {
          name
          projects {
            name
          }
        }
      }
    `))).to.deep.equal({
      users: {
        args: {},
        fields: {
          name: {},
          projects: {
            args: {},
            fields: {
              name: {}
            }
          }
        }
      }
    });
  });

  it('should simplify a basic structure with args', function () {
    expect(simplifyAST(parse(`
      {
        user(id: 1) {
          name
        }
      }
    `))).to.deep.equal({
      user: {
        args: {
          id: "1"
        },
        fields: {
          name: {}
        }
      }
    });
  });

  it('should simplify a nested structure at the lowest level', function () {
    expect(simplifyAST(parse(`
      {
        users {
          name
          projects {
            node {
              name
            }
            node {
              id
            }
          }
        }
      }
    `))).to.deep.equal({
      users: {
        args: {},
        fields: {
          name: {},
          projects: {
            args: {},
            fields: {
              node: {
                args: {},
                fields: {
                  name: {},
                  id: {}
                }
              }
            }
          }
        }
      }
    });
  });

  it('should simplify a nested structure at a high level level', function () {
    expect(simplifyAST(parse(`
      {
        users {
          name
          projects {
            node {
              name
            }
          }
          projects {
            node {
              id
            }
          }
        }
      }
    `))).to.deep.equal({
      users: {
        args: {},
        fields: {
          name: {},
          projects: {
            args: {},
            fields: {
              node: {
                args: {},
                fields: {
                  name: {},
                  id: {}
                }
              }
            }
          }
        }
      }
    });
  });
});