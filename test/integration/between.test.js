'use strict';

import { sequelize, Promise, beforeRemoveAllTables } from '../support/helper';

import { expect } from 'chai';
import sinon from 'sinon';
import Sequelize from 'sequelize';

import resolver from '../../src/resolver';

import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLList
} from 'graphql';

import GraphQLDate from 'graphql-date';


describe('between', function () {
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
  before(function () {
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

    User.Tasks = User.hasMany(Task, {as: 'tasks', foreignKey: 'userId'});
    Task.User = Task.belongsTo(User, {as: 'user', foreignKey: 'userId'});

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
        createdAt: {
          type: GraphQLDate
        },
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
        tasksByCreatedRange: {
          type: new GraphQLList(taskType),
          args: {
            range: {
              type: new GraphQLList(GraphQLDate)
            },
          },
          resolve: resolver(User.Tasks, {
            before: (options, args) => {
              options.where = options.where || {};
              options.where.createdAt = { $between: args.range};
              console.log(JSON.stringify(options.where, null, 2));
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
        }
      })
    });
  });

  /**
   * Now fill the testing DB with fixture values
   * We'll have projectA & projectB with two random labels each,
   * and two users each with some tasks that belong to those projects.
   */
  before(function () {
    var taskId = 0
      , projectId = 0;

    return sequelize.sync({force: true}).bind(this).then(function () {
      return Promise.join(
          User.create({
            id: 1,
            name: 'b' + Math.random().toString(),
            tasks: [
              {
                id: ++taskId,
                title: Math.random().toString(),
                createdAt: new Date(Date.UTC(2014, 5, 11)),
              },
              {
                id: ++taskId,
                title: Math.random().toString(),
                createdAt: new Date(Date.UTC(2014, 5, 16)),
              },
              {
                id: ++taskId,
                title: Math.random().toString(),
                createdAt: new Date(Date.UTC(2014, 5, 20)),
              }
            ]
          }, {
            include: [User.Tasks]
          }),
        ).bind(this).spread(function (userA) {
          this.userA = userA;
          this.users = [userA];
        });
      });
    });

  afterEach(function () {
    this.sandbox.restore();
  })

  it('should resolve args with between operator', function () {
    const user = this.userA;

    const from = new Date(Date.UTC(2014, 5, 10));
    const to = new Date(Date.UTC(2014, 5, 15));

    return graphql(schema, `
      query q($range: [Date]) {
        user(id: ${user.get('id')}) {
          tasksByCreatedRange(range: $range) {
            id,
            createdAt
          }
        }
      }
    `, {}, {}, { range: [from, to ]}).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].stack);
      expect(result.data.user.tasksByCreatedRange.length).to.equal(1);
    });
  });

  it('should resolve args with between operator with another input range', function () {
    const user = this.userA;

    const from = new Date(Date.UTC(2014, 5, 10));
    const to = new Date(Date.UTC(2014, 5, 18));

    return graphql(schema, `
      query q($range: [Date]) {
        user(id: ${user.get('id')}) {
          tasksByCreatedRange(range: $range) {
            id,
            createdAt
          }
        }
      }
    `, {}, {}, { range: [from, to ]}).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].stack);
      expect(result.data.user.tasksByCreatedRange.length).to.equal(2);
    });
  });

  it('should resolve args with between operator two times in a row', function () {
    const user = this.userA;

    const from = new Date(Date.UTC(2014, 5, 10));
    const to = new Date(Date.UTC(2014, 5, 15));

    return graphql(schema, `
      query q($range: [Date]) {
        user(id: ${user.get('id')}) {
          tasksByCreatedRange(range: $range) {
            id,
            createdAt
          }
        }
      }
    `, {}, {}, { range: [from, to ]}).then(function (result) {
      if (result.errors) throw new Error(result.errors[0].stack);
      console.log(JSON.stringify(result, null, 2));
      expect(result.data.user.tasksByCreatedRange.length).to.equal(1);

      const to2 = new Date(Date.UTC(2014, 5, 18));

      return graphql(schema, `
      query q($range: [Date]) {
        user(id: ${user.get('id')}) {
          tasksByCreatedRange(range: $range) {
            id,
            createdAt
          }
        }
      }
    `, {}, {}, { range: [from, to2 ]}).then(function (result) {
        if (result.errors) throw new Error(result.errors[0].stack);

        console.log(JSON.stringify(result, null, 2));

        expect(result.data.user.tasksByCreatedRange.length).to.equal(2);
      });
    });
  });
});
