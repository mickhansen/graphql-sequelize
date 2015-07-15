import * as typeMapper from './typeMapper';
import { GraphQLNonNull } from 'graphql';

module.exports = function (Model) {
  var result = {}
    , key = Model.primaryKeyAttribute
    , attribute = Model.rawAttributes[key]
    , type;

  type = new GraphQLNonNull(typeMapper.toGraphQL(attribute.type, Model.sequelize.constructor));

  result[key] = {
    type: type
  };

  return result;
};
