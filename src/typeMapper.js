import { GraphQLInt, GraphQLString, GraphQLBoolean } from 'graphql';

export function toGraphQL(sequelizeType, sequelizeTypes) {
  if (sequelizeType instanceof sequelizeTypes.BOOLEAN) {
    return GraphQLBoolean;
  } else if (sequelizeType instanceof sequelizeTypes.INTEGER) {
    return GraphQLInt;
  } else if (
    sequelizeType instanceof sequelizeTypes.STRING ||
    sequelizeType instanceof sequelizeTypes.UUID ||
    sequelizeType instanceof sequelizeTypes.DATE
  ) {
    return GraphQLString;
  } else {
    throw new Error(`Unable to convert ${sequelizeType.key || sequelizeType.toSql()} to a GraphQL type`);
  }
}
