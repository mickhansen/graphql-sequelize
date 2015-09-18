'use strict';

var chai = require('chai')
  , expect = chai.expect
  , resolver = require('../src/resolver')
  , helper = require('./helper')
  , sequelize = helper.sequelize
  , Sequelize = require('sequelize')
  , Promise = helper.Promise
  , attributeFields = require('../src/attributeFields');

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  graphql
} from 'graphql';

import {
  sequelizeNodeInterface
} from '../src/relay';

import {
  globalIdField,
  connectionDefinitions,
  connectionArgs,
  connectionFromArray
} from 'graphql-relay';

function generateTask(id) {
  return {
    id: id,
    name: Math.random().toString()
  }
}

describe('relay', function () {
  var User
    , Task
    , userType
    , taskType
    , taskConnection
    , nodeInterface
    , nodeField
    , schema;

  before(function () {
    sequelize.modelManager.models = [];
    sequelize.models = {};
    User = sequelize.define('user', {
      name: {
        type: Sequelize.STRING
      }
    }, {
      timestamps: false
    });

    Task = sequelize.define('task', {
      name: {
        type: Sequelize.STRING
      }
    }, {
      timestamps: false
    });

    User.Tasks = User.hasMany(Task, {as: 'tasks'});

    var node = sequelizeNodeInterface(sequelize, {User: userType, Task: taskType});
    nodeInterface = node.nodeInterface;
    nodeField = node.nodeField;

    taskType = new GraphQLObjectType({
      name: 'Task',
      fields: {
        id: globalIdField('Task'),
        name: {
          type: GraphQLString
        }
      },
      interfaces: [nodeInterface]
    });

    var connection = connectionDefinitions({name: 'Task', nodeType: taskType});

    taskConnection = connection.connectionType;

    userType = new GraphQLObjectType({
      name: 'User',
      fields: {
        id: globalIdField('User'),
        name: {
          type: GraphQLString
        },
        tasks: {
          type: taskConnection,
          args: connectionArgs,
          resolve: resolver(User.Tasks)
        }
      },
      interfaces: [nodeInterface]
    });

    schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
          user: {
            type: userType,
            args: {
              id: {
                type: new GraphQLNonNull(GraphQLInt)
              }
            },
            resolve: resolver(User)
          },
          users: {
            type: new GraphQLList(userType),
            args: {
              limit: {
                type: GraphQLInt
              },
              order: {
                type: GraphQLString
              }
            },
            resolve: resolver(User)
          }
        }
      })
    });

  });

  before(function () {
    var userId = 1
      , taskId = 1;

    return this.sequelize.sync({force: true}).bind(this).then(function () {
      return Promise.join(
        User.create({
          id: userId++,
          name: 'b' + Math.random().toString(),
          tasks: [generateTask(taskId++), generateTask(taskId++), generateTask(taskId++)]
        }, {
          include: [User.Tasks]
        }),
        User.create({
          id: userId++,
          name: 'a' + Math.random().toString(),
          tasks: [generateTask(taskId++), generateTask(taskId++)]
        }, {
          include: [User.Tasks]
        })
      ).bind(this).spread(function (userA, userB) {
          this.userA = userA;
          this.userB = userB;
          this.users = [userA, userB];
        });
    });
  });

  it('should resolve a plain result with a single model', function () {
    var user = this.userB;

    return graphql(schema, `
      {
        user(id: ${user.id}) {
          name
          tasks {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data).to.deep.equal({
        user: {
          name: user.name,
          tasks: {
            edges: [
              {
                node: {
                  name: user.tasks[0].name
                }
              },
              {
                node: {
                  name: user.tasks[1].name
                }
              }
            ]
          }
        }
      });
    });
  });

  it('should resolve a plain result with a single model', function () {
    var users = this.users;

    return graphql(schema, `
      {
        users {
          name
          tasks {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks.edges).to.have.length.above(0);
      });

    });
  });

});
