import Sequelize from 'sequelize';
import { GraphQLInt, GraphQLString, GraphQLBoolean } from 'graphql';

export function toGraphQL(sequelizeType) {
  if (sequelizeType instanceof Sequelize.BOOLEAN) {
    return GraphQLBoolean;
  } else if (sequelizeType instanceof Sequelize.INTEGER) {
    return GraphQLInt;
  } else if (
    sequelizeType instanceof Sequelize.STRING ||
    sequelizeType instanceof Sequelize.UUID ||
    sequelizeType instanceof Sequelize.DATE
  ) {
    return GraphQLString;
  } else {
    throw new Error(`Unable to convert ${sequelizeType.key || sequelizeType.toSql()} to a GraphQL type`);
  }
}
