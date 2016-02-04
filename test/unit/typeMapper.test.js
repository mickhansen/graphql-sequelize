import { expect } from 'chai';
import { mapType, toGraphQL } from '../../src/typeMapper';

import Sequelize from 'sequelize';

const {
  BOOLEAN,
  ENUM,
  FLOAT,
  DECIMAL,
  DOUBLE,
  INTEGER,
  BIGINT,
  STRING,
  TEXT,
  UUID,
  DATE,
  DATEONLY,
  ARRAY,
  VIRTUAL
  } = Sequelize;

import {
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLEnumType,
  GraphQLList
} from 'graphql';

describe('typeMapper', () => {

  describe('CUSTOM', function () {
    before(function () {
      //setup mapping
      mapType((type)=> {
        if (type instanceof BOOLEAN) {
          return GraphQLString
        }
        if (type instanceof FLOAT) {
          return false
        }
      });
    });
    it('should fallback to default types if it returns false', function () {
      expect(toGraphQL(new FLOAT(), Sequelize)).to.equal(GraphQLFloat);
    });
    it('should allow the user to map types to anything', function () {
      expect(toGraphQL(new BOOLEAN(), Sequelize)).to.equal(GraphQLString);
    });

    //reset mapType
    after(function () {
      mapType(null);
    });

  });


  describe('DOUBLE', function () {
    it('should map to GraphQLFloat', function () {
      expect(toGraphQL(new DOUBLE(), Sequelize)).to.equal(GraphQLFloat);
    });
  });

  describe('DECIMAL', function () {
    it('should map to GraphQLString', function () {
      expect(toGraphQL(new DECIMAL(), Sequelize)).to.equal(GraphQLString);
    });
  });

  describe('FLOAT', function () {
    it('should map to GraphQLFloat', function () {
      expect(toGraphQL(new FLOAT(), Sequelize)).to.equal(GraphQLFloat);
    });
  });
});
