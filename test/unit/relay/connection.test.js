import Sequelize from 'sequelize';
import {expect} from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support/helper';
import attributeFields from '../../../src/attributeFields';

import {
  GraphQLObjectType,
  GraphQLSchema,
  graphql
} from 'graphql';

import {
  globalIdField
} from 'graphql-relay';

import {
  sequelizeConnection
} from '../../../src/relay';

describe('relay', function () {
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

      this.beforeSpy = sinon.spy(options => options);
      this.afterSpy = sinon.spy(options => options);

      this.viewerTaskConnection = sequelizeConnection({
        name: 'Viewer' + this.Task.name,
        nodeType: this.taskType,
        target: this.User.Tasks,
        before: this.beforeSpy,
        after: this.afterSpy
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
        })
      });
    });

    beforeEach(function () {
      this.sinon = sinon.sandbox.create();

      this.viewer = this.User.build({
        id: Math.ceil(Math.random() * 999)
      });

      const task = this.Task.build();
      task.dataValues.full_count = Math.random() * 999;
      this.sinon.stub(this.Task, 'findAll').resolves([task]);
      this.sinon.stub(this.User, 'findById').resolves(this.User.build());
    });

    afterEach(function () {
      this.sinon.restore();
    });

    it('passes context, root and info to before', async function () {
      const result = await graphql(this.schema, `
        query {
          viewer {
            tasks {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `, null, {
        viewer: this.viewer
      });

      if (result.errors) throw new Error(result.errors[0]);

      expect(this.beforeSpy).to.have.been.calledOnce;
      expect(this.beforeSpy).to.have.been.calledWithMatch(
        sinon.match.any,
        sinon.match({
          first: sinon.match.any
        }),
        sinon.match({
          viewer: {
            id: this.viewer.id
          }
        }),
        sinon.match({
          ast: sinon.match.any
        })
      );

      expect(this.afterSpy).to.have.been.calledWithMatch(
        sinon.match({
          fullCount: sinon.match.number
        }),
        sinon.match({
          first: sinon.match.any
        }),
        sinon.match({
          viewer: {
            id: this.viewer.id
          }
        }),
        sinon.match({
          path: sinon.match.any
        })
      );

    });
  });
});
