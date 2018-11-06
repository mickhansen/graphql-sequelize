import { expect } from 'chai';
import { mapType, toGraphQL } from '../../src/typeMapper';
import JSONType from '../../src/types/jsonType';
import DateType from '../../src/types/dateType';

import Sequelize from 'sequelize';

const {
  BOOLEAN,
  ENUM,
  FLOAT,
  REAL,
  CHAR,
  DECIMAL,
  DOUBLE,
  INTEGER,
  BIGINT,
  STRING,
  TEXT,
  UUID,
  DATE,
  DATEONLY,
  TIME,
  ARRAY,
  VIRTUAL,
  JSON,
  JSONB
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

  describe('ARRAY', function () {
    it('should map to instance of GraphQLList', function () {
      expect(toGraphQL(new ARRAY(STRING), Sequelize)).to.instanceof(GraphQLList);
    });
  });

  describe('BIGINT', function () {
    it('should map to GraphQLString', function () {
      expect(toGraphQL(new BIGINT(), Sequelize)).to.equal(GraphQLString);
    });
  });

  describe('BOOLEAN', function () {
    it('should map to GraphQLBoolean', function () {
      expect(toGraphQL(new BOOLEAN(), Sequelize)).to.equal(GraphQLBoolean);
    });
  });

  describe('CHAR', function () {
    it('should map to GraphQLString', function () {
      expect(toGraphQL(new CHAR(), Sequelize)).to.equal(GraphQLString);
    });
  });

  describe('CUSTOM', function () {
    before(function () {
      // setup mapping
      mapType((type)=> {
        if (type instanceof BOOLEAN) {
          return GraphQLString;
        }
        if (type instanceof FLOAT) {
          return false;
        }
      });
    });
    it('should fallback to default types if it returns false', function () {
      expect(toGraphQL(new FLOAT(), Sequelize)).to.equal(GraphQLFloat);
    });
    it('should allow the user to map types to anything', function () {
      expect(toGraphQL(new BOOLEAN(), Sequelize)).to.equal(GraphQLString);
    });

    // reset mapType
    after(function () {
      mapType(null);
    });

  });

  describe('DATE', function () {
    it('should map to DateType', function () {
      expect(toGraphQL(new DATE(), Sequelize)).to.equal(DateType);
    });
  });

  describe('DATEONLY', function () {
    it('should map to GraphQLString', function () {
      expect(toGraphQL(new DATEONLY(), Sequelize)).to.equal(GraphQLString);
    });
  });

  describe('DECIMAL', function () {
    it('should map to GraphQLString', function () {
      expect(toGraphQL(new DECIMAL(), Sequelize)).to.equal(GraphQLString);
    });
  });

  describe('DOUBLE', function () {
    it('should map to GraphQLFloat', function () {
      expect(toGraphQL(new DOUBLE(), Sequelize)).to.equal(GraphQLFloat);
    });
  });

  describe('ENUM', function () {
    it('should map to instance of GraphQLEnumType', function () {
      expect(
        toGraphQL(
          new ENUM(
            'value',
            'another value',
            'two--specials',
            '25.8',
            '¼',
            '¼½',
            '¼ ½',
            '¼_½',
            ' ¼--½_¾ - '
          )
          , Sequelize
        )
      ).to.instanceof(GraphQLEnumType);
    });
  });

  describe('FLOAT', function () {
    it('should map to GraphQLFloat', function () {
      expect(toGraphQL(new FLOAT(), Sequelize)).to.equal(GraphQLFloat);
    });
  });

  describe('REAL', function () {
    it('should map to GraphQLFloat', function () {
      expect(toGraphQL(new REAL(), Sequelize)).to.equal(GraphQLFloat);
    });
  });

  describe('INTEGER', function () {
    it('should map to GraphQLInt', function () {
      expect(toGraphQL(new INTEGER(), Sequelize)).to.equal(GraphQLInt);
    });
  });

  describe('STRING', function () {
    it('should map to GraphQLString', function () {
      expect(toGraphQL(new STRING(), Sequelize)).to.equal(GraphQLString);
    });
  });

  describe('TEXT', function () {
    it('should map to GraphQLString', function () {
      expect(toGraphQL(new TEXT(), Sequelize)).to.equal(GraphQLString);
    });
  });

  describe('TIME', function () {
    it('should map to GraphQLString', function () {
      expect(toGraphQL(new TIME(), Sequelize)).to.equal(GraphQLString);
    });
  });

  describe('UUID', function () {
    it('should map to GraphQLString', function () {
      expect(toGraphQL(new UUID(), Sequelize)).to.equal(GraphQLString);
    });
  });

  describe('VIRTUAL', function () {

    it('should map to the sequelize return type', function () {
      expect(toGraphQL(new VIRTUAL(BOOLEAN, ['createdAt']), Sequelize)).to.equal(GraphQLBoolean);
    });

    it('should default to a GraphQLString is a return type is not provided', function () {
      expect(toGraphQL(new VIRTUAL(), Sequelize)).to.equal(GraphQLString);
    });

  });

  describe('JSON', function () {
    it('should map to JSONType', function () {
      expect(toGraphQL(new JSON(), Sequelize)).to.equal(JSONType); // eslint-disable-line
    });
  });

  describe('JSONB', function () {
    it('should map to JSONType', function () {
      expect(toGraphQL(new JSONB(), Sequelize)).to.equal(JSONType);
    });
  });
});
