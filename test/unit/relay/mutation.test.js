'use strict';

import {expect} from 'chai';
import Sequelize from 'sequelize';
import sinon from 'sinon';
import attributeFields from '../../../src/attributeFields';
import { sequelize } from '../../support/helper'

import {
  sequelizeConnection
} from '../../../src/relay';

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
  GraphQLID,
  graphql
} from 'graphql';

import {
  globalIdField,
  toGlobalId,
  fromGlobalId,
  mutationWithClientMutationId
} from 'graphql-relay';

describe('relay', function () {
  describe('mutation', function () {
    describe('connections', function () {
      before(function () {
        this.User = sequelize.define('user', {}, {timestamps: false});
        this.Task = sequelize.define('task', {title: Sequelize.STRING}, {timestamps: false});

        this.User.Tasks = this.User.hasMany(this.Task, {as: 'tasks', foreignKey: 'userId'});

        this.taskType = new GraphQLObjectType({
          name: this.Task.name,
          fields: {
            ...attributeFields(this.Task),
            id: globalIdField(this.Task.name)
          }
        });

        this.viewerTaskConnection = sequelizeConnection({
          name: 'Viewer' + this.Task.name,
          nodeType: this.taskType,
          target: this.User.Tasks,
          orderBy: new GraphQLEnumType({
            name: 'Viewer' + this.Task.name + 'ConnectionOrder',
            values: {
              ID: {value: [this.Task.primaryKeyAttribute, 'ASC']},
            }
          })
        });

        this.viewerType = new GraphQLObjectType({
          name: 'Viewer',
          fields: {
            tasks: {
              type: this.viewerTaskConnection.connectionType,
              args: this.viewerTaskConnection.connectionArgs,
              resolve: this.viewerTaskConnection.resolve
            }
          }
        });

        const addTaskMutation = mutationWithClientMutationId({
          name: 'addTask',
          inputFields: {
            title: {
              type: new GraphQLNonNull(GraphQLString)
            }
          },
          outputFields: () => ({
            viewer: {
              type: this.viewerType,
              resolve: (payload, {viewer}) => {
                return viewer;
              }
            },
            task: {
              type: this.taskType,
              resolve: (payload) => payload.task
            },
            newTaskEdge: {
              type: this.viewerTaskConnection.edgeType,
              resolve: (payload) => this.viewerTaskConnection.resolveEdge(payload.task)
            }
          }),
          mutateAndGetPayload: async ({title}, {viewer}) => {
            let task = await this.Task.create({
              title: title,
              userId: viewer.id
            });

            return {
              task: task
            };
          }
        });

        this.schema = new GraphQLSchema({
          query: new GraphQLObjectType({
            name: 'RootQueryType',
            fields: {
              viewer: {
                type: this.viewerType,
                resolve: function (source, args, {viewer}) {
                  return viewer;
                }
              }
            }
          }),
          mutation: new GraphQLObjectType({
            name: 'Mutation',
            fields: {
              addTask: addTaskMutation
            }
          })
        });
      });

      beforeEach(function () {
        this.sinon = sinon.sandbox.create();

        this.viewer = this.User.build({
          id: Math.ceil(Math.random() * 999)
        });

        this.sinon.stub(this.Task, 'create').resolves();
      });

      afterEach(function () {
        this.sinon.restore();
      });

      describe('addEdgeMutation', function () {
        it('should return a appropriate cursor and node', async function () {
          let title = Math.random().toString()
            , id = Math.ceil(Math.random() * 999);

          this.Task.create.resolves(this.Task.build({
            id: id,
            title: title,
            userId: this.viewer.get('id')
          }));

          let result = await graphql({
            schema: this.schema,
            source: `
              mutation {
                addTask(input: {title: "${title}", clientMutationId: "${Math.random().toString()}"}) {
                  task {
                    id
                  }

                  newTaskEdge {
                    cursor
                    node {
                      id
                      title
                    }
                  }
                }
              }
            `,
            contextValue: {
              viewer: this.viewer
            }
          });

          if (result.errors) throw new Error(result.errors[0].stack);

          expect(result.data.addTask.task.id).to.equal(toGlobalId(this.Task.name, id));
          expect(result.data.addTask.newTaskEdge.cursor).to.be.ok;
          expect(result.data.addTask.newTaskEdge.node.id).to.equal(toGlobalId(this.Task.name, id));
          expect(result.data.addTask.newTaskEdge.node.title).to.equal(title);
        });
      });
    });
  });
});
