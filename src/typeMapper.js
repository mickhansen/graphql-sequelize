import {
  GraphQLInt,
  GraphQLString,
   GraphQLBoolean,
   GraphQLFloat,
   GraphQLEnumType,
   GraphQLList
 } from 'graphql';

/**
 * Checks the type of the sequelize data type and
 * returns the corresponding type in GraphQL
 * @param  {Object} sequelizeType
 * @param  {Object} sequelizeTypes
 * @return {Function} GraphQL type declaration
 */
export function toGraphQL(sequelizeType, sequelizeTypes) {

  const {
    BOOLEAN,
    ENUM,
    FLOAT,
    INTEGER,
    BIGINT,
    STRING,
    TEXT,
    UUID,
    DATE,
    ARRAY,
    VIRTUAL
  } = sequelizeTypes;

  if (sequelizeType instanceof BOOLEAN) return GraphQLBoolean;
  if (sequelizeType instanceof FLOAT) return GraphQLFloat;

  if (sequelizeType instanceof INTEGER ||
      sequelizeType instanceof BIGINT) {
    return GraphQLString;
  }

  if (sequelizeType instanceof STRING ||
      sequelizeType instanceof TEXT ||
      sequelizeType instanceof UUID ||
      sequelizeType instanceof DATE) {
    return GraphQLString;
  }

  if (sequelizeType instanceof ARRAY) {
    let elementType = toGraphQL(sequelizeType.type, sequelizeTypes);
    return new GraphQLList(elementType);
  }

  if (sequelizeType instanceof ENUM) {
    return new GraphQLEnumType({
      values: sequelizeType.values.reduce((obj, value) => {
        obj[value] = {value};
        return obj;
      }, {})
    });
  }

  if (sequelizeType instanceof VIRTUAL) {
    let returnType = sequelizeType.returnType
        ? toGraphQL(sequelizeType.returnType, sequelizeTypes)
        : GraphQLString;
    return returnType;
  }

  throw new Error(`Unable to convert ${sequelizeType.key || sequelizeType.toSql()} to a GraphQL type`);

}
