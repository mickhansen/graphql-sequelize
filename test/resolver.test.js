'use strict';

var chai = require('chai')
  , expect = chai.expect
  , resolver = require('../src/resolver')
  , helper = require('./helper')
  , Sequelize = require('sequelize')
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
    , taskType
    , userType
    , schema

  User = sequelize.define('user', {
    name: Sequelize.STRING
  }, {
    timestamps: false
  });

  Task = sequelize.define('task', {
    title: Sequelize.STRING,
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at',
      defaultValue: Sequelize.NOW
    }
  }, {
    timestamps: false
  });

  User.Tasks = User.hasMany(Task, {as: 'tasks', foreignKey: 'userId'});
  Task.User = Task.belongsTo(User, {as: 'user', foreignKey: 'userId'});

  taskType = new GraphQLObjectType({
    name: 'Task',
    description: 'A task',
    fields: {
      id: {
        type: new GraphQLNonNull(GraphQLInt),
        description: 'The id of the task.',
      },
      title: {
        type: GraphQLString,
        description: 'The title of the task.',
      }
    }
  });

  userType = new GraphQLObjectType({
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
      },
      tasks: {
        type: new GraphQLList(taskType),
        description: 'The tasks of the user, or an empty list if they have none.',
        args: {
          limit: {
            description: 'limit the result set',
            type: GraphQLInt
          }
        },
        resolve: resolver(User.Tasks)
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
              description: 'id of the user',
              type: new GraphQLNonNull(GraphQLInt)
            },
          },
          resolve: resolver(User)
        },
        users: {
          type: new GraphQLList(userType),
          args: {
            limit: {
              description: 'limit the result set',
              type: GraphQLInt
            }
          },
          resolve: resolver(User)
        }
      }
    })
  });

  before(function () {
    return this.sequelize.sync({force: true}).bind(this).then(function () {
      return Promise.join(
        User.create({
          id: 1,
          name: 'b'+Math.random().toString(),
          tasks: [
            {
              title: Math.random().toString(),
              createdAt: new Date(Date.UTC(2014, 5, 11))
            },
            {
              title: Math.random().toString(),
              createdAt: new Date(Date.UTC(2014, 5, 16))
            },
            {
              title: Math.random().toString(),
              createdAt: new Date(Date.UTC(2014, 5, 20))
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
              title: Math.random().toString()
            },
            {
              title: Math.random().toString()
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

  it('should resolve a plain result with a single model', function () {
    var user = this.userB;

    return graphql(schema, `
      {
        user(id: ${user.id}) {
          name
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data).to.deep.equal({
        user: {
          name: user.name
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
          }
        }
      }
    `).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].message);

      expect(result.data.user.tasks).to.have.length.above(0);
      expect(result.data).to.deep.equal({
        user: {
          name: user.name,
          tasks: user.tasks.map(task => ({title: task.title}))
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
        users { 
          name
          tasks {
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
});