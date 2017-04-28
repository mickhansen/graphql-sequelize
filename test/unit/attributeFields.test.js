'use strict';

import chai from 'chai';
import Sequelize from 'sequelize';
import attributeFields from '../../src/attributeFields';
import { sequelize } from '../support/helper';
import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema
} from 'graphql';

import {
  toGlobalId
} from 'graphql-relay';

var expect = chai.expect;

describe('attributeFields', function () {
  var Model;
  var modelName = Math.random().toString();
  before(function () {
    Model = sequelize.define(modelName, {
      email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      firstName: {
        type: Sequelize.STRING
      },
      lastName: {
        type: Sequelize.STRING
      },
      char: {
        type: Sequelize.CHAR
      },
      float: {
        type: Sequelize.FLOAT
      },
      decimal: {
        type: Sequelize.DECIMAL
      },
      enum: {
        type: Sequelize.ENUM('first', 'second')
      },
      enumTwo: {
        type: Sequelize.ENUM('foo_bar', 'foo-bar')
      },
      list: {
        type: Sequelize.ARRAY(Sequelize.STRING)
      },
      virtualInteger: {
        type: new Sequelize.VIRTUAL(Sequelize.INTEGER)
      },
      virtualBoolean: {
        type: new Sequelize.VIRTUAL(Sequelize.BOOLEAN)
      },
      date: {
        type: Sequelize.DATE
      },
      time: {
        type: Sequelize.TIME
      },
      dateonly: {
        type: Sequelize.DATEONLY
      },
      comment: {
        type: Sequelize.STRING,
        comment: 'This is a comment'
      }
    }, {
      timestamps: false
    });
  });

  it('should return fields for a simple model', function () {
    var fields = attributeFields(Model);


    expect(Object.keys(fields)).to.deep.equal(['id', 'email', 'firstName', 'lastName', 'char', 'float', 'decimal', 'enum',
        'enumTwo', 'list', 'virtualInteger', 'virtualBoolean','date','time','dateonly','comment']);


    expect(fields.id.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(fields.id.type.ofType).to.equal(GraphQLInt);

    expect(fields.email.type).to.be.an.instanceOf(GraphQLNonNull);
    expect(fields.email.type.ofType).to.equal(GraphQLString);

    expect(fields.firstName.type).to.equal(GraphQLString);

    expect(fields.lastName.type).to.equal(GraphQLString);

    expect(fields.char.type).to.equal(GraphQLString);

    expect(fields.enum.type).to.be.an.instanceOf(GraphQLEnumType);

    expect(fields.enumTwo.type).to.be.an.instanceOf(GraphQLEnumType);

    expect(fields.list.type).to.be.an.instanceOf(GraphQLList);

    expect(fields.float.type).to.equal(GraphQLFloat);

    expect(fields.decimal.type).to.equal(GraphQLString);

    expect(fields.virtualInteger.type).to.equal(GraphQLInt);

    expect(fields.virtualBoolean.type).to.equal(GraphQLBoolean);

    expect(fields.date.type).to.equal(GraphQLString);

    expect(fields.time.type).to.equal(GraphQLString);

    expect(fields.dateonly.type).to.equal(GraphQLString);
  });

  it('should be possible to rename fields with a object map',function () {
    var fields = attributeFields(Model, {map: {id: 'mappedId'}});
    expect(Object.keys(fields)).to.deep.equal([
      'mappedId', 'email', 'firstName', 'lastName', 'char', 'float', 'decimal',
      'enum', 'enumTwo', 'list', 'virtualInteger', 'virtualBoolean', 'date',
      'time', 'dateonly', 'comment'
    ]);
  });

  it('should be possible to rename fields with a function that maps keys',function () {
    var fields = attributeFields(Model, {
      map: k => k + 's'
    });
    expect(Object.keys(fields)).to.deep.equal([
      'ids', 'emails', 'firstNames', 'lastNames', 'chars', 'floats', 'decimals',
      'enums', 'enumTwos', 'lists', 'virtualIntegers', 'virtualBooleans',
      'dates', 'times', 'dateonlys', 'comments'
    ]);
  });

  it('should be possible to exclude fields', function () {
    var fields = attributeFields(Model, {
      exclude: [
        'id', 'email', 'char', 'float', 'decimal', 'enum',
        'enumTwo', 'list', 'virtualInteger', 'virtualBoolean',
        'date','time','dateonly','comment'
      ]
    });

    expect(Object.keys(fields)).to.deep.equal(['firstName', 'lastName']);
  });

  it('should be able to exclude fields via a function', function () {
    var fields = attributeFields(Model, {
      exclude: field => ~[
        'id', 'email', 'char', 'float', 'decimal', 'enum',
        'enumTwo', 'list', 'virtualInteger', 'virtualBoolean',
        'date','time','dateonly','comment'
      ].indexOf(field)
    });

    expect(Object.keys(fields)).to.deep.equal(['firstName', 'lastName']);
  });

  it('should gracefully handle empty exclude arrays', function () {
    var fields = attributeFields(Model, {
      exclude: []
    });

    expect(Object.keys(fields)).to.deep.equal(['id', 'email', 'firstName',
    'lastName', 'char', 'float', 'decimal', 'enum', 'enumTwo', 'list', 'virtualInteger',
    'virtualBoolean','date','time','dateonly','comment']);
  });

  it('should gracefully handle empty only arrays', function () {
    var fields = attributeFields(Model, {
      only: []
    });

    expect(Object.keys(fields)).to.deep.equal(['id', 'email', 'firstName',
    'lastName', 'char', 'float', 'decimal', 'enum', 'enumTwo', 'list', 'virtualInteger',
    'virtualBoolean','date','time','dateonly','comment']);
  });

  it('should be possible to specify fields to include in an array', function () {
    var fields = attributeFields(Model, {
      only: ['id', 'email', 'list']
    });

    expect(Object.keys(fields)).to.deep.equal(['id', 'email', 'list']);
  });

  it('should be possible to specify fields to include via a function', function () {
    var fields = attributeFields(Model, {
      only: field => ~['id', 'email', 'list'].indexOf(field),
    });

    expect(Object.keys(fields)).to.deep.equal(['id', 'email', 'list']);
  });

  it('should be possible to automatically set a relay globalId', function () {
    var fields = attributeFields(Model, {
      globalId: true
    });

    expect(fields.id.resolve).to.be.ok;
    expect(fields.id.type.ofType.name).to.equal('ID');
    expect(fields.id.resolve({
      id: 23
    })).to.equal(toGlobalId(Model.name, 23));
  });

  it('should automatically name enum types', function () {
    var fields = attributeFields(Model);

    expect(fields.enum.type.name).to.not.be.undefined;
    expect(fields.enumTwo.type.name).to.not.be.undefined;

    expect(fields.enum.type.name).to.equal(modelName + 'enum' + 'EnumType');
    expect(fields.enumTwo.type.name).to.equal(modelName + 'enumTwo' + 'EnumType');
  });

  it('should support enum values with characters not allowed by GraphQL', function () {
    var fields = attributeFields(Model);

    expect(fields.enumTwo.type.getValues()).to.not.be.undefined;
    expect(fields.enumTwo.type.getValues()[1].name).to.equal('fooBar');
    expect(fields.enumTwo.type.getValues()[1].value).to.equal('foo-bar');
  });

  it('should support enum values with underscores', function () {
    var fields = attributeFields(Model);

    expect(fields.enumTwo.type.getValues()).to.not.be.undefined;
    expect(fields.enumTwo.type.getValues()[0].name).to.equal('foo_bar');
    expect(fields.enumTwo.type.getValues()[0].value).to.equal('foo_bar');
  });

  it('should not create multiple enum types with same name when using cache', function () {

    // Create Schema
    var schemaFn = function (fields1, fields2) {
      return function () {
        var object1 = new GraphQLObjectType({
          name: 'Object1',
          fields: fields1
        });
        var object2 = new GraphQLObjectType({
          name: 'Object2',
          fields: fields2
        });
        return new GraphQLSchema({
          query: new GraphQLObjectType({
            name: 'RootQueryType',
            fields: {
              object1: {
                type: object1,
                resolve: function () {
                  return {};
                }
              },
              object2: {
                type: object2,
                resolve: function () {
                  return {};
                }
              }
            }
          })
        });
      };
    };

    // Bad: Will create multiple/duplicate types with same name
    var fields1a = attributeFields(Model);
    var fields2a = attributeFields(Model);

    expect(schemaFn(fields1a, fields2a)).to.throw(Error);

    // Good: Will use cache and not create mutliple/duplicate types with same name
    var cache = {};
    var fields1b = attributeFields(Model, {cache: cache});
    var fields2b = attributeFields(Model, {cache: cache});

    expect(schemaFn(fields1b, fields2b)).to.not.throw(Error);

  });

  describe('with non-default primary key', function () {
    var ModelWithoutId;
    var modelName = Math.random().toString();
    before(function () {
      ModelWithoutId = sequelize.define(modelName, {
        email: {
          primaryKey: true,
          type: Sequelize.STRING,
        },
        firstName: {
          type: Sequelize.STRING
        },
        lastName: {
          type: Sequelize.STRING
        },
        float: {
          type: Sequelize.FLOAT
        },
      }, {
        timestamps: false
      });
    });

    it('should return fields', function () {
      var fields = attributeFields(ModelWithoutId);

      expect(Object.keys(fields)).to.deep.equal(['email', 'firstName', 'lastName', 'float']);

      expect(fields.email.type).to.be.an.instanceOf(GraphQLNonNull);
      expect(fields.email.type.ofType).to.equal(GraphQLString);

      expect(fields.firstName.type).to.equal(GraphQLString);

      expect(fields.lastName.type).to.equal(GraphQLString);

      expect(fields.float.type).to.equal(GraphQLFloat);
    });

    it('should be possible to automatically set a relay globalId', function () {
      var fields = attributeFields(ModelWithoutId, {
        globalId: true
      });

      expect(fields.id.resolve).to.be.ok;
      expect(fields.id.type.ofType.name).to.equal('ID');
      expect(fields.id.resolve({
        email: 'idris@example.com'
      })).to.equal(toGlobalId(ModelWithoutId.name, 'idris@example.com'));
    });

    it('should be possible to bypass NonNull', function () {
      var fields = attributeFields(Model, {
        allowNull: true,
      });

      expect(fields.email.type).to.not.be.an.instanceOf(GraphQLNonNull);
      expect(fields.email.type).to.equal(GraphQLString);
    });

    it('should be possible to comment attributes', function () {
      var fields = attributeFields(Model, {
        commentToDescription: true
      });

      expect(fields.comment.description).to.equal('This is a comment');
    });

  });
});
