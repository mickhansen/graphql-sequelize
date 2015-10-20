import { expect } from 'chai';
import { toGraphQL } from '../src/typeMapper';

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
  describe('DOUBLE', function () {
    it('should map to GraphQLFloat', function () {
      expect(toGraphQL(new DOUBLE(), Sequelize)).to.equal(GraphQLFloat);
    });
  });

  describe('DECIMAL', function () {
    it('should map to GraphQLFloat', function () {
      expect(toGraphQL(new DECIMAL(), Sequelize)).to.equal(GraphQLFloat);
    });
  });

  describe('FLOAT', function () {
    it('should map to GraphQLFloat', function () {
      expect(toGraphQL(new FLOAT(), Sequelize)).to.equal(GraphQLFloat);
    });
  });
});
