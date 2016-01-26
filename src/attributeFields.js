import * as typeMapper from './typeMapper';
import { GraphQLNonNull, GraphQLEnumType } from 'graphql';
import { globalIdField } from 'graphql-relay';

module.exports = function (Model, options) {
  options = options || {};

  var result = Object.keys(Model.rawAttributes).reduce(function (memo, key) {
    if (options.exclude && ~options.exclude.indexOf(key)) return memo;
    if (options.only && !~options.only.indexOf(key)) return memo;

    var attribute = Model.rawAttributes[key]
      , type = attribute.type;

    // determine the key
    var mappedKey = key;
    if (options.map) {
      if (typeof options.map === 'function') {
        mappedKey = options.map(key);
      } else {
        mappedKey = options.map[key] || key;
      }
    }

    memo[mappedKey] = {
      type: typeMapper.toGraphQL(type, Model.sequelize.constructor)
    };

    if (memo[mappedKey].type instanceof GraphQLEnumType ) {
      memo[mappedKey].type.name = `${Model.name}${mappedKey}EnumType`;
    }

    if (attribute.allowNull === false || attribute.primaryKey === true) {
      memo[mappedKey].type = new GraphQLNonNull(memo[mappedKey].type);
    }

    return memo;
  }, {});

  if (options.globalId) {
    result.id = globalIdField(Model.name, instance => instance[Model.primaryKeyAttribute]);
  }

  return result;
};
