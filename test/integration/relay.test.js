'use strict';

import { sequelize, Promise, beforeRemoveAllTables } from '../support/helper';

import { expect } from 'chai';
import resolver from '../../src/resolver';
import Sequelize from 'sequelize';
import sinon from'sinon';

import {
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  graphql
} from 'graphql';

import {
  sequelizeNodeInterface
} from '../../src/relay';

import {
  globalIdField,
  toGlobalId,
  fromGlobalId,
  connectionDefinitions,
  connectionArgs
} from 'graphql-relay';

function generateTask(id) {
  return {
    id: id,
    name: Math.random().toString()
  };
}

const generateCustom = Promise.method(id => {
  return {
    id,
    value: `custom type ${ id }`
  };
});

describe('relay', function () {
  beforeRemoveAllTables();

  var User
    , Task
    , userType
    , taskType
    , nodeInterface
    , Project
    , projectType
    , viewerType
    , nodeField
    , schema;

  before(function () {
    sequelize.modelManager.models = [];
    sequelize.models = {};
    User = sequelize.define('User', {
      name: {
        type: Sequelize.STRING
      }
    }, {
      timestamps: false
    });

    Task = sequelize.define('Task', {
      name: {
        type: Sequelize.STRING
      }
    }, {
      timestamps: false
    });

    Project = sequelize.define('Project', {
      name: {
        type: Sequelize.STRING
      }
    }, {
      timestamps: false
    });

    User.Tasks = User.hasMany(Task, {as: 'taskItems'}); // Specifically different from connection type name
    Project.Users = Project.hasMany(User, {as: 'users'});


    var node = sequelizeNodeInterface(sequelize);
    nodeInterface = node.nodeInterface;
    nodeField = node.nodeField;
    var nodeTypeMapper = node.nodeTypeMapper;

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
          args: connectionArgs,
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

    viewerType = new GraphQLObjectType({
      name: 'Viewer',
      description: 'root viewer for queries',
      fields: () => ({
        id: globalIdField('Viewer'),
        name: {
          type: GraphQLString,
          resolve: () => 'Viewer!'
        },
        allProjects: {
          type: new GraphQLList(projectType),
          resolve: resolver(Project)
        }
      }),
      interfaces: [nodeInterface]
    });

    const customType = new GraphQLObjectType({
      name: 'Custom',
      description: 'Custom type to test custom idFetcher',
      fields: {
        id: globalIdField('Custom'),
        value: {
          type: GraphQLString,
        }
      },
      interfaces: [nodeInterface]
    });

    nodeTypeMapper.mapTypes({
      [User.name]: { type: 'User' },
      [Project.name]: { type: projectType},
      [Task.name]: { type: taskType },
      Viewer: { type: viewerType },
      [customType.name]: {
        type: customType,
        resolve(globalId) {
          const { id } = fromGlobalId(globalId);
          return generateCustom(id);
        }
      }
    });


    schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
          viewer: {
            type: viewerType,
            resolve: () => ({
              name: 'Viewer!',
              id: 1
            })
          },
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
          },
          custom: {
            type: customType,
            args: {
              id: {
                type: new GraphQLNonNull(GraphQLInt)
              }
            },
            resolve: generateCustom
          },
          userConnection: {
            type: userConnection.connectionType,
            args: connectionArgs,
            resolve: resolver(User)
          },
          node: nodeField
        }
      })
    });

  });

  before(function () {
    var userId = 1
      , projectId = 1
      , taskId = 1;

    return sequelize.sync({force: true}).bind(this).then(function () {
      return Promise.join(
        Project.create({
          id: projectId++,
          name: 'project-' + Math.random().toString()
        }),
        User.create({
          id: userId++,
          name: 'a' + Math.random().toString(),
          [User.Tasks.as]: [generateTask(taskId++), generateTask(taskId++), generateTask(taskId++)]
        }, {
          include: [User.Tasks]
        }),
        User.create({
          id: userId++,
          name: 'b' + Math.random().toString(),
          [User.Tasks.as]: [generateTask(taskId++), generateTask(taskId++)]
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

  it('should support unassociated GraphQL types', function () {
    var globalId = toGlobalId('Viewer');
    return graphql(schema, `
      {
        node(id: "${globalId}") {
          id
        }
      }
    `).then(result => {
      expect(result.data.node.id).to.equal(globalId);
    });

  });

  it('should return userA when running a node query', function () {
    var user = this.userA
      , globalId = toGlobalId('User', user.id);

    return graphql(schema, `
      {
        node(id: "${globalId}") {
          id
          ... on User {
            name
          }
        }
      }
    `).then(result => {
      expect(result.data.node.id).to.equal(globalId);
      expect(result.data.node.name).to.equal(user.name);
    });
  });

  describe('node queries', function () {
    it('should allow returning a custom entity', function () {
      generateCustom(1).then(custom => {
        const globalId = toGlobalId('Custom', custom.id);

        return graphql(schema, `
          {
            node(id: "${globalId}") {
              id
              ... on Custom {
                value
              }
            }
          }
        `).then(result => {
          expect(result.data.node.id).to.equal(globalId);
          expect(result.data.node.value).to.equal(custom.value);
        });
      });
    });

    it('should merge nested queries from multiple fragments', function () {
      var globalId = toGlobalId('Viewer');
      return graphql(schema, `
        {
          node(id: "${globalId}") {
            id
            ... F0
            ... F1
          }
        }
        fragment F0 on Viewer {
          allProjects {
            id
          }
        }
        fragment F1 on Viewer {
          allProjects {
            id
            name
          }
        }
      `).then(result => {
        if (result.errors) throw result.errors[0];

        expect(result.data.node.allProjects[0].id).to.not.be.null;
        expect(result.data.node.allProjects[0].name).to.not.be.null;
      });
    });
  });

  it('should support first queries on connections', function () {
    var user = this.userB;

    return graphql(schema, `
      {
        user(id: ${user.id}) {
          name
          tasks(first: 1) {
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
                  name: user.taskItems[0].name
                }
              }
            ]
          }
        }
      });
    });
  });

  it('should support last queries on connections', function () {
    var user = this.userB;

    return graphql(schema, `
      {
        user(id: ${user.id}) {
          name
          tasks(last: 1) {
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
                  name: user[User.Tasks.as][user[User.Tasks.as].length - 1].name
                }
              }
            ]
          }
        }
      });
    });
  });

  // these two tests are not determenistic on postgres currently
  it('should support after queries on connections', function () {
    var user = this.userA;

    return graphql(schema, `
      {
        user(id: ${user.id}) {
          name
          tasks(first: 1) {
            pageInfo {
              hasNextPage,
              startCursor
            },
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `)
    .then(function (result) {
      return graphql(schema, `
        {
          user(id: ${user.id}) {
            name
            tasks(first: 1, after: "${result.data.user.tasks.pageInfo.startCursor}") {
              edges {
                node {
                  name
                }
              }
            }
          }
        }
      `);
    })
    .then(function (result) {
      expect(result.data.user.tasks.edges[0].node.name).to.equal(user.taskItems[1].name);
    });
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
                  name: user.taskItems[0].name
                }
              },
              {
                node: {
                  name: user.taskItems[1].name
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
    var sqlSpy = sinon.spy();

    return graphql(schema, `
      {
        project(id: 1) {
          users {
            edges {
              node {
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
          }
        }
      }
    `, null).then(result => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.project.users.edges).to.have.length(2);
      let [nodeA, nodeB] = result.data.project.users.edges;
      let userA = nodeA.node;
      let userB = nodeB.node;

      expect(userA).to.have.property('tasks');
      expect(userA.tasks.edges).to.have.length.above(0);
      expect(userA.tasks.edges[0].node.name).to.be.ok;

      expect(userB).to.have.property('tasks');
      expect(userB.tasks.edges).to.have.length.above(0);
      expect(userB.tasks.edges[0].node.name).to.be.ok;
    });
  });

  it('should support fragments', function () {
    return graphql(schema, `
      {
        project(id: 1) {
          ...getNames
        }
      }
      fragment getNames on Project {
        name
      }
    `).then(result => {
      if (result.errors) throw new Error(result.errors[0].stack);
    });
  });

  it('should support inline fragments', function () {
    return graphql(schema, `
      {
        project(id: 1) {
          ... on Project {
            name
          }
        }
      }
    `).then(result => {
      if (result.errors) throw new Error(result.errors[0].stack);
    });
  });

  it('should not support fragments on the wrong type', function () {
    return graphql(schema, `
      {
        project(id: 1) {
          ...getNames
        }
      }
      fragment getNames on User {
        name
      }
    `).then(result => {
      expect(result.errors).to.exist.and.have.length(1);
    });
  });


  it('should support root query on connections', function () {
    var user = this.userA;

    return graphql(schema, `
      {
        userConnection(first: 1) {
          edges {
            node {
              name
              tasks(first: 1) {
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
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data).to.deep.equal({
        userConnection: {
          edges: [
            {
              node: {
                name: user.name,
                tasks: {
                  edges: [
                    {
                      node: {
                        name: user.taskItems[0].name
                      }
                    }
                  ]
                }
              }
            },
          ],
        }
      });
    });
  });

});
