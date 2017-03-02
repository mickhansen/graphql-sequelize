'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mapType = mapType;
exports.toGraphQL = toGraphQL;

var _graphql = require('graphql');

let customTypeMapper;
/**
 * A function to set a custom mapping of types
 * @param {Function} mapFunc
 */
function mapType(mapFunc) {
  customTypeMapper = mapFunc;
}

/**
 * Checks the type of the sequelize data type and
 * returns the corresponding type in GraphQL
 * @param  {Object} sequelizeType
 * @param  {Object} sequelizeTypes
 * @return {Function} GraphQL type declaration
 */
function toGraphQL(sequelizeType, sequelizeTypes) {

  // did the user supply a mapping function?
  // use their mapping, if it returns truthy
  // else use our defaults
  if (customTypeMapper) {
    let result = customTypeMapper(sequelizeType);
    if (result) return result;
  }

  const BOOLEAN = sequelizeTypes.BOOLEAN,
        ENUM = sequelizeTypes.ENUM,
        FLOAT = sequelizeTypes.FLOAT,
        CHAR = sequelizeTypes.CHAR,
        DECIMAL = sequelizeTypes.DECIMAL,
        DOUBLE = sequelizeTypes.DOUBLE,
        INTEGER = sequelizeTypes.INTEGER,
        BIGINT = sequelizeTypes.BIGINT,
        STRING = sequelizeTypes.STRING,
        TEXT = sequelizeTypes.TEXT,
        UUID = sequelizeTypes.UUID,
        DATE = sequelizeTypes.DATE,
        DATEONLY = sequelizeTypes.DATEONLY,
        TIME = sequelizeTypes.TIME,
        ARRAY = sequelizeTypes.ARRAY,
        VIRTUAL = sequelizeTypes.VIRTUAL;

  // Regex for finding special characters

  const specialChars = /[^a-z\d_]/i;

  if (sequelizeType instanceof BOOLEAN) return _graphql.GraphQLBoolean;

  if (sequelizeType instanceof FLOAT || sequelizeType instanceof DOUBLE) return _graphql.GraphQLFloat;

  if (sequelizeType instanceof INTEGER) {
    return _graphql.GraphQLInt;
  }

  if (sequelizeType instanceof CHAR || sequelizeType instanceof STRING || sequelizeType instanceof TEXT || sequelizeType instanceof UUID || sequelizeType instanceof DATE || sequelizeType instanceof DATEONLY || sequelizeType instanceof TIME || sequelizeType instanceof BIGINT || sequelizeType instanceof DECIMAL) {
    return _graphql.GraphQLString;
  }

  if (sequelizeType instanceof ARRAY) {
    let elementType = toGraphQL(sequelizeType.type, sequelizeTypes);
    return new _graphql.GraphQLList(elementType);
  }

  if (sequelizeType instanceof ENUM) {
    return new _graphql.GraphQLEnumType({
      values: sequelizeType.values.reduce((obj, value) => {
        let sanitizedValue = value;
        if (specialChars.test(value)) {
          sanitizedValue = value.split(specialChars).reduce((reduced, val, idx) => {
            let newVal = val;
            if (idx > 0) {
              newVal = `${val[0].toUpperCase()}${val.slice(1)}`;
            }
            return `${reduced}${newVal}`;
          });
        }
        obj[sanitizedValue] = { value: value };
        return obj;
      }, {})
    });
  }

  if (sequelizeType instanceof VIRTUAL) {
    let returnType = sequelizeType.returnType ? toGraphQL(sequelizeType.returnType, sequelizeTypes) : _graphql.GraphQLString;
    return returnType;
  }

  throw new Error(`Unable to convert ${sequelizeType.key || sequelizeType.toSql()} to a GraphQL type`);
}