import { GraphQLInt, GraphQLString } from 'graphql';

module.exports = function () {
  return {
    limit: {
      type: GraphQLInt
    },
    order: {
      type: GraphQLString
    }
  };
};
