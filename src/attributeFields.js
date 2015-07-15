import * as typeMapper from './typeMapper';
import { GraphQLNonNull } from 'graphql';

module.exports = function (Model, options) {
  options = options || {};

  var result = Object.keys(Model.rawAttributes).reduce(function (memo, key) {
    if (options.exclude && ~options.exclude.indexOf(key)) return memo;

    var attribute = Model.rawAttributes[key]
      , type = attribute.type;

    memo[key] = {
      type: typeMapper.toGraphQL(type, Model.sequelize.constructor)
    };

    if (attribute.allowNull === false || attribute.primaryKey === true) {
      memo[key].type = new GraphQLNonNull(memo[key].type);
    }

    return memo;
  }, {});

  return result;
};
