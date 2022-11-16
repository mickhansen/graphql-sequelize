'use strict';

import { delay, sequelize, beforeRemoveAllTables } from '../support/helper';

import { expect } from 'chai';
import sinon from 'sinon';
import Sequelize, { Op } from 'sequelize';

import resolver from '../../src/resolver';
import JSONType from '../../src/types/jsonType';

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
  beforeRemoveAllTables();

  var User
    , Task
    , Project
    , Label
    , taskType
    , userType
    , projectType
    , labelType
    , schema;

  /**
   * Setup the a) testing db schema and b) the according GraphQL types
   *
   * The schema consists of a User that has Tasks.
   * A Task belongs to a Project, which can have Labels.
   */
  before(() => {
    this.sandbox = sinon.sandbox.create();

    sequelize.modelManager.models = [];
    sequelize.models = {};

    User = sequelize.define('user', {
      name: Sequelize.STRING,
      myVirtual: {
        type: Sequelize.VIRTUAL,
        get: function () {
          return 'lol';
        }
      }
    });

    Task = sequelize.define('task', {
      title: Sequelize.STRING,
      createdAt: {
        type: Sequelize.DATE,
        field: 'created_at',
        defaultValue: Sequelize.NOW
      },
      taskVirtual: {
        type: Sequelize.VIRTUAL,
        get: function () {
          return 'tasktask';
        }
      }
    }, {
      timestamps: false
    });

    Project = sequelize.define('project', {
      name: Sequelize.STRING
    }, {
      timestamps: false
    });

    Label = sequelize.define('label', {
      name: Sequelize.STRING
    }, {
      timestamps: false
    });

    User.Tasks = User.hasMany(Task, {as: 'tasks', foreignKey: 'userId'});
    Task.User = Task.belongsTo(User, {as: 'user', foreignKey: 'userId'});

    Task.Project = Task.belongsTo(Project, {as: 'project', foreignKey: 'projectId'});
    Project.Labels = Project.hasMany(Label, {as: 'labels'});

    labelType = new GraphQLObjectType({
      name: 'Label',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLInt)
        },
        name: {
          type: GraphQLString
        }
      }
    });

    projectType = new GraphQLObjectType({
      name: 'Project',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLInt)
        },
        name: {
          type: GraphQLString
        },
        labels: {
          type: new GraphQLList(labelType),
          resolve: resolver(Project.Labels)
        }
      }
    });

    taskType = new GraphQLObjectType({
      name: 'Task',
      description: 'A task',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLInt)
        },
        title: {
          type: GraphQLString
        },
        taskVirtual: {
          type: GraphQLString
        },
        project: {
          type: projectType,
          resolve: resolver(Task.Project)
        }
      }
    });

    userType = new GraphQLObjectType({
      name: 'User',
      description: 'A user',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLInt),
        },
        name: {
          type: GraphQLString,
        },
        myVirtual: {
          type: GraphQLString
        },
        tasks: {
          type: new GraphQLList(taskType),
          args: {
            limit: {
              type: GraphQLInt
            },
            offset: {
              type: GraphQLInt
            },
            order: {
              type: GraphQLString
            },
            first: {
              type: GraphQLInt
            }
          },
          resolve: resolver(() => User.Tasks, {
            before: function (options, args) {
              if (args.first) {
                options.order = options.order || [];
                options.order.push(['created_at', 'ASC']);

                if (args.first !== 0) {
                  options.limit = args.first;
                }
              }

              return options;
            }
          })
        },
        tasksByIds: {
          type: new GraphQLList(taskType),
          args: {
            ids: {
              type: new GraphQLList(GraphQLInt)
            }
          },
          resolve: resolver(User.Tasks, {
            before: (options, args) => {
              options.where = options.where || {};
              options.where.id = { [Op.in]: args.ids };

              return options;
            }
          })
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
            resolve: resolver(User, {
              contextToOptions: {
                a: 'a',
                b: 'c'
              }
            })
          },
          users: {
            type: new GraphQLList(userType),
            args: {
              limit: {
                type: GraphQLInt
              },
              order: {
                type: GraphQLString
              },
              where: {
                type: JSONType
              }
            },
            resolve: resolver(User)
          }
        }
      })
    });
  });

  /**
   * Now fill the testing DB with fixture values
   * We'll have projectA & projectB with two random labels each,
   * and two users each with some tasks that belong to those projects.
   */
  before(() => {
    var taskId = 0
      , projectId = 0;

    return sequelize.sync({force: true}).then(() => {
      return Promise.all([
        Project.create({
          id: ++projectId,
          name: 'b' + Math.random().toString(),
          labels: [
            {name: Math.random().toString()},
            {name: Math.random().toString()}
          ]
        }, {
          include: [
            Project.Labels
          ]
        }),
        Project.create({
          id: ++projectId,
          name: 'a' + Math.random().toString(),
          labels: [
            {name: Math.random().toString()},
            {name: Math.random().toString()}
          ]
        }, {
          include: [
            Project.Labels
          ]
        })
      ]).then(([projectA, projectB]) => {
        this.projectA = projectA;
        this.projectB = projectB;
      }).then(() => {
        return Promise.all([
          User.create({
            id: 1,
            name: 'b' + Math.random().toString(),
            tasks: [
              {
                id: ++taskId,
                title: Math.random().toString(),
                createdAt: new Date(Date.UTC(2014, 5, 11)),
                projectId: this.projectA.id
              },
              {
                id: ++taskId,
                title: Math.random().toString(),
                createdAt: new Date(Date.UTC(2014, 5, 16)),
                projectId: this.projectB.id
              },
              {
                id: ++taskId,
                title: Math.random().toString(),
                createdAt: new Date(Date.UTC(2014, 5, 20)),
                projectId: this.projectA.id
              }
            ]
          }, {
            include: [User.Tasks]
          }),
          User.create({
            id: 2,
            name: 'a' + Math.random().toString(),
            tasks: [
              {
                id: ++taskId,
                title: Math.random().toString(),
                projectId: this.projectB.id
              },
              {
                id: ++taskId,
                title: Math.random().toString(),
                projectId: this.projectB.id
              }
            ]
          }, {
            include: [User.Tasks]
          }),
        ]).then(([userA, userB]) => {
          this.userA = userA;
          this.userB = userB;

          this.users = [userA, userB];
        });
      });
    });
  });

  beforeEach(() => {
    this.sandbox.spy(User, 'findOne');
  });
  afterEach(() => {
    this.sandbox.restore();
  });

  it('should resolve a plain result with a single model', () => {
    var user = this.userB;

    return graphql({
      schema: schema,
      source: `
        {
          user(id: ${user.id}) {
            name
            myVirtual
          }
        }
      `,
      contextValue: {},
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data).to.deep.equal({
        user: {
          name: user.name,
          myVirtual: 'lol'
        }
      });
    });
  });

  it('should map context to find options', () => {
    var user = this.userB;

    return graphql({
      schema,
      source: `
        {
          user(id: ${user.id}) {
            name
            myVirtual
          }
        }
      `,
      contextValue: {a: 1, b: 2}
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data).to.deep.equal({
        user: {
          name: user.name,
          myVirtual: 'lol'
        }
      });

      expect(User.findOne.firstCall.args[0].a).to.equal(1);
      expect(User.findOne.firstCall.args[0].c).to.equal(2);
    });
  });

  it('should resolve a plain result with an aliased field', () => {
    var user = this.userB;

    return graphql({
      schema,
      source: `
        {
          user(id: ${user.id}) {
            name
            magic: myVirtual
          }
        }
      `,
      contextValue: {},
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data).to.deep.equal({
        user: {
          name: user.name,
          magic: 'lol'
        }
      });
    });
  });

  it('should resolve a plain result with a single model and aliases', () => {
    var userA = this.userA
      , userB = this.userB;

    return graphql({
      schema,
      source: `
        {
          userA: user(id: ${userA.id}) {
            name
            myVirtual
          }
          userB: user(id: ${userB.id}) {
            name
            myVirtual
          }
        }
      `,
      contextValue: {},
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data).to.deep.equal({
        userA: {
          name: userA.name,
          myVirtual: 'lol'
        },
        userB: {
          name: userB.name,
          myVirtual: 'lol'
        }
      });
    });
  });

  it('should resolve a array result with a model and aliased includes', () => {
    return graphql({
      schema,
      source: `
        {
          users {
            name

            first: tasks(limit: 1) {
              title
            }

            rest: tasks(offset: 1, limit: 99) {
              title
            }
          }
        }
      `,
      contextValue: {},
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      result.data.users.forEach(function (user) {
        expect(user.first).to.be.ok;
        expect(user.rest).to.be.ok;
      });
    });
  });

  it('should resolve a array result with a model and aliased includes and __typename', () => {
    return graphql({
      schema,
      source: `
        {
          users {
            name

            first: tasks(limit: 1) {
              title
              __typename
            }
          }
        }
      `
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      result.data.users.forEach(function (user) {
        expect(user.first[0].__typename).to.equal('Task');
      });
    });
  });

  it('should resolve an array result with a single model', () => {
    var users = this.users;

    return graphql({
      schema,
      source: `
        {
          users {
            name
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users).to.have.length.above(0);

      const usersNames = users.map(user => ({name: user.name}));
      // As the GraphQL query doesn't specify an ordering,
      // the order of the two lists can not be asserted.
      expect(result.data.users).to.deep.have.members(usersNames);
    });
  });

  it('should allow amending the find for a array result with a single model', () => {
    var user = this.userA
      , schema;

    schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
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
            resolve: resolver(User, {
              before: function (options, args, {name}) {
                options.where = options.where || {};
                options.where.name = name;
                return options;
              }
            })
          }
        }
      })
    });

    return graphql({
      schema,
      source: `
        {
          users {
            name
          }
        }
      `,
      contextValue: {
        name: user.name
      },
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users).to.have.length(1);
      expect(result.data.users[0].name).to.equal(user.name);
    });
  });

  it('should allow parsing the find for a array result with a single model', () => {
    var users = this.users
      , schema;

    schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
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
            resolve: resolver(User, {
              after: function (result) {
                return result.map(function () {
                  return {
                    name: '11!!'
                  };
                });
              }
            })
          }
        }
      })
    });

    return graphql({
      schema,
      source: `
        {
          users {
            name
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users).to.have.length(users.length);
      result.data.users.forEach(function (user) {
        expect(user.name).to.equal('11!!');
      });
    });
  });

  it('should work with a resolver through a proxy', () => {
    var users = this.users
      , schema
      , userType
      , taskType
      , spy = sinon.spy();

    taskType = new GraphQLObjectType({
      name: 'Task',
      description: 'A task',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLInt)
        },
        title: {
          type: GraphQLString
        }
      }
    });

    userType = new GraphQLObjectType({
      name: 'User',
      description: 'A user',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLInt),
        },
        name: {
          type: GraphQLString,
        },
        tasks: {
          type: new GraphQLList(taskType),
          resolve: (function () {
            var $resolver = resolver(User.Tasks)
              , $proxy;

            $proxy = function () {
              return $resolver.apply(null, Array.prototype.slice.call(arguments));
            };

            $proxy.$proxy = $resolver;
            return $proxy;
          }())
        }
      }
    });

    schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
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

    return graphql({
      schema,
      source: `
        {
          users {
            name,
            tasks {
              title
            }
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users).to.have.length(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).to.have.length.above(0);
      });
    });
  });

  it('should work with a passthrough resolver and a duplicated query', () => {
    var users = this.users
      , schema
      , userType
      , taskType
      , spy = sinon.spy();

    taskType = new GraphQLObjectType({
      name: 'Task',
      description: 'A task',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLInt)
        },
        title: {
          type: GraphQLString
        }
      }
    });

    userType = new GraphQLObjectType({
      name: 'User',
      description: 'A user',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLInt),
        },
        name: {
          type: GraphQLString,
        },
        tasks: {
          type: new GraphQLObjectType({
            name: 'Tasks',
            fields: {
              nodes: {
                type: new GraphQLList(taskType),
                resolve: resolver(User.Tasks)
              }
            }
          }),
          resolve: (function () {
            var $resolver;

            $resolver = function (source) {
              return source;
            };

            $resolver.$passthrough = true;

            return $resolver;
          }())
        }
      }
    });

    schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
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

    return graphql({
      schema,
      source: `
        {
          users {
            name,
            tasks {
              nodes {
                title
              }
              nodes {
                id
              }
            }
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users).to.have.length(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks.nodes).to.have.length.above(0);
        user.tasks.nodes.forEach(function (task) {
          expect(task.title).to.be.ok;
          expect(task.id).to.be.ok;
        });
      });
    });
  });

  it('should resolve an array result with a single model and limit', () => {
    return graphql({
      schema,
      source: `
        {
          users(limit: 1) {
            name
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users).to.have.length(1);
    });
  });

  it('should resolve a plain result with a single hasMany association', () => {
    const user = this.userB;

    return graphql({
      schema,
      source: `
        {
          user(id: ${user.id}) {
            name
            tasks {
              title
              taskVirtual
            }
          }
        }
      `,
      contextValue: {
        yolo: 'swag'
      },
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.user.name).to.equal(user.name);

      expect(result.data.user.tasks).to.have.length.above(0);
      // As the order of user.tasks is nondeterministic, we only assert on equal members
      // of both the user's tasks and the tasks the graphql query responded with.
      const userTasks = user.tasks.map(task => ({title: task.title, taskVirtual: 'tasktask'}));
      expect(result.data.user.tasks).to.deep.have.members(userTasks);
    });

  });

  it('should resolve a plain result with a single limited hasMany association', () => {
    var user = this.userB;

    return graphql({
      schema,
      source: `
        {
          user(id: ${user.id}) {
            name
            tasks(limit: 1) {
              title
            }
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.user.tasks).to.have.length(1);
    });
  });

  it('should resolve a array result with a single hasMany association', () => {
    var users = this.users;

    return graphql({
      schema,
      source: `
        {
          users(order: "id") {
            name
            tasks(order: "id") {
              title
            }
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be.above(0);
      });

      expect(result.data).to.deep.equal({
        users: users.map(function (user) {
          return {
            name: user.name,
            tasks: user.tasks.map(task => ({title: task.title}))
          };
        })
      });
    });
  });

  it('should resolve a array result with a single limited hasMany association', () => {
    var users = this.users;

    return graphql({
      schema,
      source: `
        {
          users {
            name
            tasks(limit: 1) {
              title
            }
          }
        }
      `
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be(1);
      });
    });
  });

  it('should resolve a array result with a single limited hasMany association with a nested belongsTo relation', () => {
    var users = this.users
      , sqlSpy = sinon.spy();

    return graphql({
      schema,
      source: `
        {
          users {
            tasks(limit: 2) {
              title
              project {
                name
              }
            }
          }
        }
      `
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be(2);
        user.tasks.forEach(function (task) {
          expect(task.project.name).to.be.ok;
        });
      });
    });
  });

  it('should resolve a array result with a single hasMany association with a nested belongsTo relation', () => {
    var users = this.users
      , sqlSpy = sinon.spy();

    return graphql({
      schema,
      source: `
        {
          users {
            tasks {
              title
              project {
                name
              }
            }
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be.above(0);
        user.tasks.forEach(function (task) {
          expect(task.project.name).to.be.ok;
        });
      });
    });
  });

  it('should resolve a array result with a single hasMany association' +
     'with a nested belongsTo relation with a nested hasMany relation', () => {
    var users = this.users
      , sqlSpy = sinon.spy();

    return graphql({
      schema,
      source: `
        {
          users {
            tasks {
              title
              project {
                name
                labels {
                  name
                }
              }
            }
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be.above(0);
        user.tasks.forEach(function (task) {
          expect(task.project.name).to.be.ok;

          expect(task.project.labels).length.to.be.above(0);
          task.project.labels.forEach(function (label) {
            expect(label.name).to.be.ok;
          });
        });
      });
    });
  });

  it('should resolve a array result with a single limited hasMany association with a before filter', () => {
    var users = this.users;

    return graphql({
      schema,
      source: `
        {
          users {
            tasks(first: 2) {
              title
            }
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be(2);
      });
    });
  });

  it('should not call association getter if user manually included', () => {
    this.sandbox.spy(Task, 'findAll');
    this.sandbox.spy(User, 'findAll');

    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
          users: {
            type: new GraphQLList(userType),
            resolve: resolver(User, {
              before: function (options) {
                options.include = [User.Tasks];
                options.order = [
                  ['id'],
                  [{ model: Task, as: 'tasks' }, 'id', 'ASC']
                ];
                return options;
              }
            })
          }
        }
      })
    });

    return graphql({
      schema,
      source: `
        {
          users {
            tasks {
              title
            }
          }
        }
      `,
    }).then(result => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(Task.findAll.callCount).to.equal(0);
      expect(User.findAll.callCount).to.equal(1);
      expect(User.findAll.getCall(0).args[0].include).to.have.length(1);
      expect(User.findAll.getCall(0).args[0].include[0].name).to.equal(User.Tasks.name);

      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be.above(0);
      });

      expect(result.data).to.deep.equal({
        users: this.users.map(function (user) {
          return {
            tasks: user.tasks.map(task => ({title: task.title}))
          };
        })
      });
    });
  });

  it('should allow async before and after', () => {
    var users = this.users
      , schema;

    schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
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
            resolve: resolver(User, {
              before: function (options) {
                return Promise.resolve(options);
              },
              after: async function (result) {
                await delay(100);
                return result.map(function () {
                  return {
                    name: 'Delayed!'
                  };
                });
              }
            })
          }
        }
      })
    });

    return graphql({
      schema,
      source: `
        {
          users {
            name
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users).to.have.length(users.length);
      result.data.users.forEach(function (user) {
        expect(user.name).to.equal('Delayed!');
      });
    });
  });

  it('should resolve args from array to before', () => {
    var user = this.userB;

    return graphql({
      schema,
      source: `
        {
          user(id: ${user.get('id')}) {
            tasksByIds(ids: [${user.tasks[0].get('id')}]) {
              id
            }
          }
        }
      `,
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.user.tasksByIds.length).to.equal(1);
    });
  });

  it('should resolve query variables inside where parameter', () => {
    return graphql({
      schema,
      source: `
        query($where: SequelizeJSON) {
          users(where: $where) {
            id
          }
        }
      `,
      variableValues: {
        where: '{"name": {"like": "a%"}}',
      },
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users[0].id).to.equal(2);
      expect(result.data.users.length).to.equal(1);
    });
  });

  it('should resolve query variables inside where parameter', () => {
    return graphql({
      schema,
      source: `
        query($name: String) {
          users(where: {name: {like: $name}}) {
            id
          }
        }
      `,
      variableValues: {name: 'a%'}
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users[0].id).to.equal(2);
      expect(result.data.users.length).to.equal(1);
    });
  });

  it('should allow list queries set as NonNullable', () => { 
    var user = this.userA
      , schema;

    schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
          users: {
            type: new GraphQLNonNull(new GraphQLList(userType)),
            resolve: resolver(User, {
              before: function (options, args, { name }) {
                options.where = options.where || {};
                options.where.name = name;
                return options;
              }
            })
          }
        }
      })
    });

    return graphql({
      schema,
      source: `
        {
          users {
            name
          }
        }
      `,
      contextValue: {
        name: user.name,
      },
    }).then((result) => {
      if (result.errors) throw new Error(result.errors[0].stack);

      expect(result.data.users).to.have.length(1);
      expect(result.data.users[0].name).to.equal(user.name);
    });
  });
});
