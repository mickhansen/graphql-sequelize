import { GraphQLInt, GraphQLString } from 'graphql';
import Sequelize from 'sequelize';

module.exports = function (Model) {
  var result = {}
    , key = Model.primaryKeyAttribute
    , attribute = Model.rawAttributes[key]
    , type;

  if (attribute.type instanceof Sequelize.INTEGER) {
    type = GraphQLInt;
  } else if (attribute.type instanceof Sequelize.STRING || attribute.type instanceof Sequelize.UUID) {
    type = GraphQLString;
  } else {
    throw new Error(`Unable to convert ${attribute.type.toSql()} to a GraphQL type`);
  }

  result[key] = {
    type: type
  };

  return result;
};
