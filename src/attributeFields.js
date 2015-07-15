import * as typeMapper from './typeMapper';
import { GraphQLNonNull } from 'graphql';

module.exports = function (Model) {
  var result = Object.keys(Model.rawAttributes).reduce(function (memo, key) {
    var attribute = Model.rawAttributes[key]
      , type = attribute.type;

    memo[key] = {
      type: typeMapper.toGraphQL(type)
    };

    if (attribute.allowNull === false || attribute.primaryKey === true) {
      memo[key].type = new GraphQLNonNull(memo[key].type);
    }

    return memo;
  }, {});

  return result;
};
