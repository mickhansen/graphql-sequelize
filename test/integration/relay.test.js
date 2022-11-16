'use strict';

import { sequelize, beforeRemoveAllTables } from '../support/helper';

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

async function generateCustom(id) {
  return {
    id,
    value: `custom type ${ id }`
  };
}

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

  before(() => {
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
      },
      interfaces: [nodeInterface]
    });

    viewerType = new GraphQLObjectType({
      name: 'Viewer',
      description: 'root viewer for queries',
      fields: () => ({
        id: globalIdField('Viewer', () => 1),
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
        type: 'Custom',
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
          node: nodeField
        }
      })
    });
  });

  before(() => {
    var userId = 1
      , projectId = 1
      , taskId = 1;

    return sequelize.sync({ force: true }).then(() => {
      return Promise.all([
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
      ]).then(([project, userA, userB]) => {
        this.project = project;
        this.userA = userA;
        this.userB = userB;
        this.users = [userA, userB];
      });
    });
  });

  before(() => {
    return this.project.setUsers([this.userA.id, this.userB.id]);
  });

  it('should support unassociated GraphQL types', () => {
    var globalId = toGlobalId('Viewer', 1);

    return graphql({
      schema,
      source: `
        {
          node(id: "${globalId}") {
            id
          }
        }
    `}).then(result => {
      expect(result.data.node.id).to.equal(globalId);
    });

  });

  it('should return userA when running a node query', () => {
    var user = this.userA
      , globalId = toGlobalId('User', user.id);

    return graphql({
      schema,
      source: `
        {
          node(id: "${globalId}") {
            id
            ... on User {
              name
            }
          }
        }
      `
    }).then(result => {
      expect(result.data.node.id).to.equal(globalId);
      expect(result.data.node.name).to.equal(user.name);
    });
  });

  describe('node queries', () => {
    it('should allow returning a custom entity', () => {
      generateCustom(1).then(async custom => {
        const globalId = toGlobalId('Custom', custom.id);

        return graphql({
          schema,
          source: `
            {
              node(id: "${globalId}") {
                id
                ... on Custom {
                  value
                }
              }
            }
          `
        }).then(result => {
          expect(result.data.node.id).to.equal(globalId);
          expect(result.data.node.value).to.equal(custom.value);
        });
      });
    });

    it('should merge nested queries from multiple fragments', () => {
      var globalId = toGlobalId('Viewer', 1);

      return graphql({
        schema,
        source: `
          {
            node(id: "${globalId}") {
              id
              ...F0
              ...F1
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
        `
      }).then(result => {
        if (result.errors) throw result.errors[0];

        expect(result.data.node.allProjects[0].id).to.not.be.null;
        expect(result.data.node.allProjects[0].name).to.not.be.null;
      });
    });
  });

  it('should support first queries on connections', () => {
    var user = this.userB;

    return graphql({
      schema,
      source: `
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
      `
    }).then((result) => {
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

  it('should support last queries on connections', () => {
    var user = this.userB;

    return graphql({
      schema,
      source: `
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
      `
    }).then((result) => {
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
  it('should support after queries on connections', () => {
    var user = this.userA;

    return graphql({
      schema,
      source: `
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
      `
    })
    .then((result) => {
      return graphql({
        schema,
        source: `
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
        `
      });
    }).then((result) => {
      expect(result.data.user.tasks.edges[0].node.name).to.equal(user.taskItems[1].name);
    });
  });

  it('should resolve a plain result with a single connection', () => {
    var user = this.userB;

    return graphql({
      schema,
      source: `
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
      `
    }).then((result) => {
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

  it('should resolve an array of objects containing connections', () => {
    var users = this.users;

    return graphql({
      schema,
      source: `
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
      `
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks.edges).to.have.length.above(0);
      });

    });
  });

  it('should resolve nested connections', () => {
    var sqlSpy = sinon.spy();

    return graphql({
      schema,
      source: `
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
      `,
    }).then(result => {
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

  it('should support fragments', () => {
    return graphql({
      schema,
      source: `
        {
          project(id: 1) {
            ...getNames
          }
        }
        fragment getNames on Project {
          name
        }
      `
    }).then(result => {
      if (result.errors) throw new Error(result.errors[0].stack);
    });
  });

  it('should support inline fragments', () => {
    return graphql({
      schema,
      source: `
        {
          project(id: 1) {
            ... on Project {
              name
            }
          }
        }
      `
    }).then(result => {
      if (result.errors) throw new Error(result.errors[0].stack);
    });
  });

  it('should not support fragments on the wrong type', () => {
    return graphql({
      schema,
      source: `
        {
          project(id: 1) {
            ...getNames
          }
        }
        fragment getNames on User {
          name
        }
      `
    }).then(result => {
      expect(result.errors).to.exist.and.have.length(1);
    });
  });
});
