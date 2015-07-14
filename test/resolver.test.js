'use strict';

var chai = require('chai')
  , expect = chai.expect
  , resolver = require('../src/resolver')
  , helper = require('./helper')
  , Sequelize = require('sequelize')
  , sequelize = helper.sequelize

import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLList
} from 'graphql';

describe('resolver', function () {
  describe('model', function () {
    let User = sequelize.define('user', {
      name: Sequelize.STRING
    });

    let userType = new GraphQLObjectType({
      name: 'User',
      description: 'A user',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLInt),
          description: 'The id of the user.',
        },
        name: {
          type: GraphQLString,
          description: 'The name of the user.',
        }
      }
    });

    beforeEach(function () {
      return sequelize.sync({force: true});
    });

    it('should resolve a plain result from a simple model', function () {
      let schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            user: {
              type: userType,
              args: {
                id: {
                  description: 'id of the user',
                  type: new GraphQLNonNull(GraphQLInt)
                }
              },
              resolve: resolver(User)
            }
          }
        })
      });

      let name = Math.random().toString();

      return User.bulkCreate([{
        id: 1,
        name: Math.random().toString()
      }, {
        id: 2,
        name: name
      }]).then(function () {
        return graphql(schema, '{ user(id: 2) { name } }').then(function (result) {
          expect(result.data).to.deep.equal({
            user: {
              name: name
            }
          });
        });
      });
    });

    it('should resolve an array result from a simple model', function () {
      let schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            users: {
              type: new GraphQLList(userType),
              resolve: resolver(User)
            }
          }
        })
      });

      let nameA = Math.random().toString();
      let nameB = Math.random().toString();

      return User.bulkCreate([{
        id: 1,
        name: nameA
      }, {
        id: 2,
        name: nameB
      }]).then(function () {
        return graphql(schema, '{ users { name } }').then(function (result) {
          expect(result.data).to.deep.equal({
            users: [
              {
                name: nameA
              },
              {
                name: nameB
              }
            ]
          });
        });
      });
    });
  });
});