import {
  GraphQLString,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLBoolean
} from 'graphql';

import {
  globalIdField,
  connectionDefinitions,
  connectionArgs
} from 'graphql-relay';

import resolver from '../../lib/resolver';

import {
  sequelizeNodeInterface
} from '../../lib/relay';

import { sequelize, models } from './models';

const node = sequelizeNodeInterface(sequelize);
const nodeInterface = node.nodeInterface;

const taskType = new GraphQLObjectType({
  name: 'Task',
  fields: () => ({
    id: globalIdField('Task'),
    completed: {
      type: GraphQLBoolean
    },
    name: {
      type: GraphQLString
    },
    user: {
      type: userType,
      resolve: resolver(models.Task.User)
    },
    subTasks: {
      type: subtaskConnection.connectionType,
      args: connectionArgs,
      resolve: resolver(models.Task.SubTask)
    }
  }),
  interfaces: [nodeInterface]
});

const userType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: globalIdField('User'),
    name: {
      type: GraphQLString
    },
    tasks: {
      type: taskConnection.connectionType,
      args: {
        completed: {
          type: GraphQLBoolean,
        },
        ...connectionArgs
      },
      resolve: resolver(models.User.Tasks, {
        before: (options, args) => {
          if (args.hasOwnProperty('completed')) {
            options.where = {
              completed: args.completed
            };
          }

          return options;
        }
      })
    },
    subordinates: {
      type: subordinateConnection.connectionType,
      args: connectionArgs,
      resolve: resolver(models.User.Subordinates)
    }
  }),
  interfaces: [nodeInterface]
});

const projectType = new GraphQLObjectType({
  name: 'Project',
  fields: () => ({
    id: globalIdField('Project'),
    users: {
      type: userConnection.connectionType,
      args: connectionArgs,
      resolve: resolver(models.Project.Users)
    }
  }),
  interfaces: [nodeInterface]
});

const taskConnection = connectionDefinitions({name: 'Task', nodeType: taskType})
  , subordinateConnection = connectionDefinitions({name: 'Subordinate', nodeType: userType})
  , subtaskConnection = connectionDefinitions({name: 'Subtask', nodeType: taskType})
  , userConnection = connectionDefinitions({name: 'User', nodeType: userType});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      projects: {
        type: new GraphQLList(projectType),
        args: {
          limit: {
            type: GraphQLInt
          },
          order: {
            type: GraphQLString
          }
        },
        resolve: resolver(models.Project)
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
        resolve: resolver(models.User)
      },
      tasks: {
        type: new GraphQLList(taskType),
        args: {
          limit: {
            type: GraphQLInt
          },
          order: {
            type: GraphQLString
          }
        },
        resolve: resolver(models.Task, {
          before: findOptions => {
            // we only want top-level tasks, not subtasks
            findOptions.where = {
              user_id: { // eslint-disable-line
                $not: null
              }
            };
            return findOptions;
          }
        })
      }
    }
  })
});

export {
  schema
};
