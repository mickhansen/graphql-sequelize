'use strict';

import {expect} from 'chai';
import helper from '../helper';
import Sequelize from 'sequelize';
import attributeFields from '../../src/attributeFields';
import resolver from '../../src/resolver';

const {
  sequelize,
  Promise
} = helper;

import {
  sequelizeConnection
} from '../../src/relay';

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
  globalIdField,
  toGlobalId,
  fromGlobalId
} from 'graphql-relay';

if (helper.sequelize.dialect.name === 'postgres') {
  describe('relay', function () {
    describe('connection', function () {
      before(async function () {
        var self = this;

        this.User = sequelize.define('user', {

        });

        this.Project = sequelize.define('project', {

        });

        this.Task = sequelize.define('task', {
          name: Sequelize.STRING
        }, {
          timestamps: true
        });

        this.User.Tasks = this.User.hasMany(this.Task, {as: 'tasks'});
        this.User.Projects = this.User.hasMany(this.Project, {as: 'projects'});

        this.Project.Tasks = this.Project.hasMany(this.Task, {as: 'tasks'});
        this.Task.Project = this.Task.belongsTo(this.Project, {as: 'project'});

        this.taskType = new GraphQLObjectType({
          name: this.Task.name,
          fields: {
            ...attributeFields(this.Task),
            id: globalIdField(this.Task.name)
          }
        });

        this.projectType = new GraphQLObjectType({
          name: this.Project.name,
          fields: {
            ...attributeFields(this.Project),
            id: globalIdField(this.Project.name)
          }
        });

        this.userTaskConnection = sequelizeConnection({
          name: this.Task.name,
          nodeType: this.taskType,
          target: this.User.Tasks,
          orderBy: new GraphQLEnumType({
            name: this.Task.name + 'ConnectionOrder',
            values: {
              ID: {value: [this.Task.primaryKeyAttribute, 'ASC']},
              OLDEST: {value: ['createdAt', 'ASC']},
              NEWEST: {value: ['createdAt', 'DESC']}
            }
          })
        });
        this.userType = new GraphQLObjectType({
          name: this.User.name,
          fields: {
            ...attributeFields(this.User),
            id: globalIdField(this.User.name),
            tasks: {
              type: this.userTaskConnection.connectionType,
              args: this.userTaskConnection.connectionArgs,
              resolve: this.userTaskConnection.resolve
            }
          }
        });

        this.schema = new GraphQLSchema({
          query: new GraphQLObjectType({
            name: 'RootQueryType',
            fields: {
              user: {
                type: this.userType,
                args: {
                  id: {
                    type: new GraphQLNonNull(GraphQLInt)
                  }
                },
                resolve: resolver(this.User)
              }
            }
          })
        });

        await this.sequelize.sync({force: true});
        
        this.userA = await this.User.create({
          [this.User.Tasks.as]: [
            {name: Math.random().toString(), createdAt: new Date(Date.now() - 10500)},
            {name: Math.random().toString(), createdAt: new Date(Date.now() - 9500)},
            {name: Math.random().toString(), createdAt: new Date(Date.now() - 8500)},
            {name: Math.random().toString(), createdAt: new Date(Date.now() - 7500)},
            {name: Math.random().toString(), createdAt: new Date(Date.now() - 6500)},
            {name: Math.random().toString(), createdAt: new Date(Date.now() - 5500)},
            {name: Math.random().toString(), createdAt: new Date(Date.now() - 4500)},
            {name: Math.random().toString(), createdAt: new Date(Date.now() - 3500)},
            {name: Math.random().toString(), createdAt: new Date(Date.now() - 2500)}
          ]
        }, {
          include: [this.User.Tasks]
        });
      });

      it('should support in-query slicing and pagination with an orderBy', async function () {
        let firstThree = this.userA.tasks.slice(this.userA.tasks.length - 3, this.userA.tasks.length);
        let nextThree = this.userA.tasks.slice(this.userA.tasks.length - 6, this.userA.tasks.length - 3);
        let lastThree = this.userA.tasks.slice(this.userA.tasks.length - 9, this.userA.tasks.length - 6);

        let verify = function(result, expectedTasks) {
          if (result.errors) throw new Error(result.errors[0].stack);

          var resultTasks = result.data.user.tasks.edges.map(function (edge) {
            return edge.node;
          });

          expect(resultTasks.length).to.equal(3);
          expect(resultTasks.map((task) => {
            return parseInt(fromGlobalId(task.id).id, 10);
          }).sort()).to.deep.equal(expectedTasks.map(function (task) {
            return task.get('id');
          }).sort());
        };

        let query = (after) => {
          return graphql(this.schema, `
            {
              user(id: ${this.userA.id}) {
                tasks(first: 3, ${after ? 'after: "'+after+'", ' : ''} orderBy: NEWEST) {
                  edges {
                    cursor
                    node {
                      id
                      name
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }
            }
          `);
        }

        let firstResult = await query();
        verify(firstResult, firstThree);
        expect(firstResult.data.user.tasks.pageInfo.hasNextPage).to.equal(true);

        let nextResult = await query(firstResult.data.user.tasks.pageInfo.endCursor);
        verify(nextResult, nextThree);
        expect(nextResult.data.user.tasks.pageInfo.hasNextPage).to.equal(true);

        let lastResult = await query(nextResult.data.user.tasks.edges[2].cursor);
        verify(lastResult, lastThree);
        expect(lastResult.data.user.tasks.pageInfo.hasNextPage).to.equal(false);
      });
    });
  });
}