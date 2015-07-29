'use strict';

var chai = require('chai')
  , expect = chai.expect
  , resolver = require('../src/resolver')
  , helper = require('./helper')
  , Sequelize = require('sequelize')
  , sinon = require('sinon')
  , sequelize = helper.sequelize
  , Promise = helper.Promise;

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
  var User
    , Task
    , Project
    , Label
    , taskType
    , userType
    , projectType
    , labelType
    , schema;

  User = sequelize.define('user', {
    name: Sequelize.STRING,
    myVirtual: {
      type: Sequelize.VIRTUAL,
      get: function() {
        return 'lol';
      }
    }
  }, {
    timestamps: false
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
      get: function() {
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
          order: {
            type: GraphQLString
          },
          first: {
            type: GraphQLInt
          }
        },
        resolve: resolver(User.Tasks, {
          before: function(options, args) {
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
        }
      }
    })
  });

  before(function () {
    var userId = 0
      , taskId = 0
      , projectId = 0;

    return this.sequelize.sync({force: true}).bind(this).then(function () {
      return Promise.join(
        Project.create({
          id: ++projectId,
          name: 'b'+Math.random().toString(),
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
          name: 'a'+Math.random().toString(),
          labels: [
            {name: Math.random().toString()},
            {name: Math.random().toString()}
          ]
        }, {
          include: [
            Project.Labels
          ]
        })
      ).bind(this).spread(function (projectA, projectB) {
        this.projectA = projectA;
        this.projectB = projectB;
      }).bind(this).then(function () {
        return Promise.join(
          User.create({
            id: 1,
            name: 'b'+Math.random().toString(),
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
            name: 'a'+Math.random().toString(),
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
          })
        ).bind(this).spread(function (userA, userB) {
          this.userA = userA;
          this.userB = userB;
          this.users = [userA, userB];
        });
      });
    });
  });

  it('should resolve a plain result with a single model', function () {
    var user = this.userB;

    return graphql(schema, `
      {
        user(id: ${user.id}) {
          name
          myVirtual
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data).to.deep.equal({
        user: {
          name: user.name,
          myVirtual: 'lol'
        }
      });
    });
  });

  it('should resolve an array result with a single model', function () {
    var users = this.users;

    return graphql(schema, `
      {
        users {
          name
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users).to.have.length.above(0);
      expect(result.data).to.deep.equal({
        users: users.map(user => ({name: user.name}))
      });
    });
  });

  it('should allow ammending the find for a array result with a single model', function () {
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
              before: function(options, args, root) {
                options.where = options.where || {};
                options.where.name = root.name;
                return options;
              }
            })
          }
        }
      })
    });

    return graphql(schema, `
      {
        users {
          name
        }
      }
    `, {
      name: user.name
    }).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users).to.have.length(1);
      expect(result.data.users[0].name).to.equal(user.name);
    });
  });

  it('should allow parsing the find for a array result with a single model', function () {
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
              after: function(result, args, root) {
                return result.map(function () {
                  return {
                    name: '11!!'
                  }
                });
              }
            })
          }
        }
      })
    });

    return graphql(schema, `
      {
        users {
          name
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users).to.have.length(users.length);
      result.data.users.forEach(function (user) {
        expect(user.name).to.equal('11!!')
      })
    });
  });

  it('should work with a resolver through a proxy', function () {
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

            $proxy = function() {
              return $resolver.apply(null, Array.prototype.slice.call(arguments))
            };

            $proxy.$proxy = $resolver;
            return $proxy;
          })()
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

    return graphql(schema, `
      {
        users {
          name,
          tasks {
            title
          }
        }
      }
    `, {
      logging: spy
    }).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users).to.have.length(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).to.have.length.above(0);
      });

      expect(spy).to.have.been.calledOnce;
    });
  });

  it('should work with a resolver with include: false', function () {
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
          resolve: resolver(User.Tasks)
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
            resolve: resolver(User, {
              include: false
            })
          }
        }
      })
    });

    return graphql(schema, `
      {
        users {
          name,
          tasks {
            title
          }
        }
      }
    `, {
      logging: spy
    }).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users).to.have.length(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).to.have.length.above(0);
      });

      expect(spy.callCount).to.equal(1 + users.length);
    });
  });

  it('should work with a passthrough resolver and a duplicated query', function () {
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
          resolve: (function() {
            var $resolver;

            $resolver = function(source) {
              return source;
            };

            $resolver.$passthrough = true;

            return $resolver;
          })()
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

    return graphql(schema, `
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
    `, {
      logging: spy
    }).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users).to.have.length(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks.nodes).to.have.length.above(0);
        user.tasks.nodes.forEach(function (task) {
          expect(task.title).to.be.ok;
          expect(task.id).to.be.ok;
        });
      });

      expect(spy).to.have.been.calledOnce;
    });
  });

  it('should resolve an array result with a single model and limit', function () {
    var users = this.users;

    return graphql(schema, `
      {
        users(limit: 1) {
          name
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users).to.have.length(1);
    });
  });

  it('should resolve a plain result with a single hasMany association', function () {
    var user = this.userB;

    return graphql(schema, `
      { 
        user(id: ${user.id}) {
          name
          tasks {
            title
            taskVirtual
          }
        }
      }
    `, {
      yolo: 'swag'
    }).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.user.tasks).to.have.length.above(0);
      expect(result.data).to.deep.equal({
        user: {
          name: user.name,
          tasks: user.tasks.map(task => ({title: task.title, taskVirtual: 'tasktask'}))
        }
      });
    });
  });

  it('should resolve a plain result with a single limited hasMany association', function () {
    var user = this.userB;

    return graphql(schema, `
      { 
        user(id: ${user.id}) {
          name
          tasks(limit: 1) {
            title
          }
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.user.tasks).to.have.length(1);
    });
  });

  it('should resolve a array result with a single hasMany association', function () {
    var users = this.users;

    return graphql(schema, `
      {
        users(order: "id") { 
          name
          tasks(order: "id") {
            title
          }
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be.above(0);
      });

      expect(result.data).to.deep.equal({
        users: users.map(function (user) {
          return {
            name: user.name,
            tasks: user.tasks.map(task => ({title: task.title}))
          }
        })
      });
    });
  });

  it('should resolve a array result with a single limited hasMany association', function () {
    var users = this.users;

    return graphql(schema, `
      {
        users { 
          name
          tasks(limit: 1) {
            title
          }
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be(1);
      });
    });
  });

  it('should resolve a array result with a single limited hasMany association with a nested belongsTo relation', function () {
    var users = this.users
      , sqlSpy = sinon.spy()

    return graphql(schema, `
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
    `, {
      logging: sqlSpy
    }).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be(2);
        user.tasks.forEach(function (task) {
          expect(task.project.name).to.be.ok;
        });
      });

      expect(sqlSpy.callCount).to.equal(1 + users.length);
    });
  });

  it('should resolve a array result with a single hasMany association with a nested belongsTo relation', function () {
    var users = this.users
      , sqlSpy = sinon.spy()

    return graphql(schema, `
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
    `, {
      logging: sqlSpy
    }).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be.above(0);
        user.tasks.forEach(function (task) {
          expect(task.project.name).to.be.ok;
        });
      });

      expect(sqlSpy.callCount).to.equal(1);
    });
  });

  it('should resolve a array result with a single hasMany association with a nested belongsTo relation with a nested hasMany relation', function () {
    var users = this.users
      , sqlSpy = sinon.spy()

    return graphql(schema, `
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
    `, {
      logging: sqlSpy
    }).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

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

      expect(sqlSpy.callCount).to.equal(1);
    });
  });

  it('should resolve a array result with a single limited hasMany association with a before filter', function () {
    var users = this.users;

    return graphql(schema, `
      {
        users {
          tasks(first: 2) {
            title
          }
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.users.length).to.equal(users.length);
      result.data.users.forEach(function (user) {
        expect(user.tasks).length.to.be(2);
      });
    });
  });
});