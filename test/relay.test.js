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
    , Project
    , projectType
    , userConnection
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

    Project = sequelize.define('name', {
      name: {
        type: Sequelize.STRING
      }
    }, {
      timestamps: false
    });

    User.Tasks = User.hasMany(Task, {as: 'tasks'});
    Project.Users = Project.hasMany(User, {as: 'users'});

    var node = sequelizeNodeInterface(sequelize, {Project: projectType, User: userType, Task: taskType});
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

    var taskConnection = connectionDefinitions({name: 'Task', nodeType: taskType});


    userType = new GraphQLObjectType({
      name: 'User',
      fields: {
        id: globalIdField('User'),
        name: {
          type: GraphQLString
        },
        tasks: {
          type: taskConnection.connectionType,
          args: {
            test: {
              type: GraphQLBoolean
            }
          },
          resolve: resolver(User.Tasks)
        }
      },
      interfaces: [nodeInterface]
    });

    var userConnection = connectionDefinitions({name: 'User', nodeType: userType});

    projectType = new GraphQLObjectType({
      name: 'Project',
      fields: {
        id: globalIdField('User'),
        name: {
          type: GraphQLString
        },
        users: {
          type: userConnection.connectionType,
          args: connectionArgs,
          resolve: resolver(Project.Users)
        }
      }
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
          },
          project: {
            type: projectType,
            args: {
              id: {
                type: new GraphQLNonNull(GraphQLInt)
              }
            },
            resolve: resolver(Project)
          }
        }
      })
    });

  });

  before(function () {
    var userId = 1
      , projectId = 1
      , taskId = 1;

    return this.sequelize.sync({force: true}).bind(this).then(function () {
      return Promise.join(
        Project.create({
          id: projectId++,
          name: 'project-' + Math.random().toString()
        }),
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
      ).bind(this).spread(function (project, userA, userB) {
          this.project = project;
          this.userA = userA;
          this.userB = userB;
          this.users = [userA, userB];
        });
    });
  });

  before(function () {
    return this.project.setUsers([this.userA.id, this.userB.id]);
  });

  it('should resolve a plain result with a single connection', function () {
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

  it('should resolve an array of objects containing connections', function () {
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

  it('should resolve nested connections', function () {
    var project = this.project;

    return graphql(schema, `
      {
        project(id: 1) {
          users {
            edges {
              node {
                name
                tasks(test: true) {
                  edges {
                    node {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `).then(result => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.project.users.edges).to.have.length(2);
      let [nodeA, nodeB] = result.data.project.users.edges;
      let userA = nodeA.node;
      let userB = nodeB.node;
      expect(userA).to.have.property('tasks');
      expect(userA.tasks.edges).to.have.length.above(0);
      expect(userB).to.have.property('tasks');
      expect(userB.tasks.edges).to.have.length.above(0);
    });
  });

});
