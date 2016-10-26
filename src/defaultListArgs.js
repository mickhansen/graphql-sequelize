import { GraphQLList, GraphQLInt, GraphQLString } from 'graphql';
import JSONType from './types/jsonType';

module.exports = function () {
  return {
    limit: {
      type: GraphQLInt
    },
    order: {
      type: new GraphQLList(new GraphQLList(GraphQLString))
    },
    where: {
      type: JSONType,
      description: 'A JSON object conforming the the shape specified in http://docs.sequelizejs.com/en/latest/docs/querying/'
    },
    offset: {
      type: GraphQLInt
    }
  };

};
