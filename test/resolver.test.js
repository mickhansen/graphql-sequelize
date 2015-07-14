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
  let User = sequelize.define('user', {
    name: Sequelize.STRING
  });

  describe('model', function () {
    let userType = new GraphQLObjectType({
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
        }
      }
    });

    beforeEach(function () {
      return sequelize.sync({force: true});
    });

    it('should resolve a plain result from a simple model', function () {
      let schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            user: {
              type: userType,
              args: {
                id: {
                  description: 'id of the user',
                  type: new GraphQLNonNull(GraphQLInt)
                }
              },
              resolve: resolver(User)
            }
          }
        })
      });

      let name = Math.random().toString();

      return User.bulkCreate([{
        id: 1,
        name: Math.random().toString()
      }, {
        id: 2,
        name: name
      }]).then(function () {
        return graphql(schema, '{ user(id: 2) { name } }').then(function (result) {
          expect(result.data).to.deep.equal({
            user: {
              name: name
            }
          });
        });
      });
    });

    it('should resolve an array result from a simple model', function () {
      let schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            users: {
              type: new GraphQLList(userType),
              resolve: resolver(User)
            }
          }
        })
      });

      let nameA = Math.random().toString();
      let nameB = Math.random().toString();

      return User.bulkCreate([{
        id: 1,
        name: nameA
      }, {
        id: 2,
        name: nameB
      }]).then(function () {
        return graphql(schema, '{ users { name } }').then(function (result) {
          expect(result.data).to.deep.equal({
            users: [
              {
                name: nameA
              },
              {
                name: nameB
              }
            ]
          });
        });
      });
    });
  });

  describe('associations', function () {
    let Task = sequelize.define('task', {
      title: Sequelize.STRING
    });

    User.Tasks = User.hasMany(Task, {as: 'tasks'});

    let taskType = new GraphQLObjectType({
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

    let userType = new GraphQLObjectType({
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
          resolve: resolver(User.Tasks)
        }
      }
    });

    beforeEach(function () {
      return sequelize.sync({force: true});
    });

    it('should resolve a plain result with associations', function () {
      let schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            user: {
              type: userType,
              args: {
                id: {
                  description: 'id of the user',
                  type: new GraphQLNonNull(GraphQLInt)
                }
              },
              resolve: resolver(User)
            }
          }
        })
      });

      let name = Math.random().toString();
      let titleA = Math.random().toString();
      let titleB = Math.random().toString();

      return Promise.join(
        User.create({
          id: 1,
          name: Math.random().toString(),
          tasks: [
            {
              title: Math.random().toString()
            },
            {
              title: Math.random().toString()
            },
            {
              title: Math.random().toString()
            }
          ]
        }, {
          include: [User.Tasks]
        }),
        User.create({
          id: 2,
          name: name,
          tasks: [
            {
              title: titleA
            },
            {
              title: titleB
            }
          ]
        }, {
          include: [User.Tasks]
        })
      ).then(function () {
        return graphql(schema, '{ user(id: 2) { name, tasks { title } } }').then(function (result) {
          expect(result.data).to.deep.equal({
            user: {
              name: name,
              tasks: [
                {
                  title: titleA
                },
                {
                  title: titleB
                }
              ]
            }
          });
        });
      });
    });

    it('should resolve a array result with associations', function () {
      let schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            users: {
              type: new GraphQLList(userType),
              resolve: resolver(User)
            }
          }
        })
      });

      let nameA = Math.random().toString();
      let nameB = Math.random().toString();
      let titleA = Math.random().toString();
      let titleB = Math.random().toString();
      let titleC = Math.random().toString();
      let titleD = Math.random().toString();
      let titleE = Math.random().toString();

      return Promise.join(
        User.create({
          id: 1,
          name: nameA,
          tasks: [
            {
              title: titleC
            },
            {
              title: titleD
            },
            {
              title: titleE
            }
          ]
        }, {
          include: [User.Tasks]
        }),
        User.create({
          id: 2,
          name: nameB,
          tasks: [
            {
              title: titleA
            },
            {
              title: titleB
            }
          ]
        }, {
          include: [User.Tasks]
        })
      ).then(function () {
        return graphql(schema, '{ users { name, tasks { title } } }').then(function (result) {
          expect(result.data).to.deep.equal({
            users: [
              {
                name: nameA,
                tasks: [
                  {
                    title: titleC
                  },
                  {
                    title: titleD
                  },
                  {
                    title: titleE
                  }
                ]
              },
              {
                name: nameB,
                tasks: [
                  {
                    title: titleA
                  },
                  {
                    title: titleB
                  }
                ]
              }
            ]
          });
        });
      });
    });
  });
});