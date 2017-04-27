import * as typeMapper from './typeMapper';
import { GraphQLNonNull, GraphQLEnumType } from 'graphql';
import { globalIdField } from 'graphql-relay';

module.exports = function (Model, options = {}) {
  var cache = options.cache || {};
  var result = Object.keys(Model.rawAttributes).reduce(function (memo, key) {
    if (options.exclude) {
      if (typeof options.exclude === 'function' && options.exclude(key)) return memo;
      if (Array.isArray(options.exclude) && options.exclude.indexOf(key) !== -1) return memo;
    }
    if (options.only) {
      if (typeof options.only === 'function' && !options.only(key)) return memo;
      if (Array.isArray(options.only) && options.only.indexOf(key) !== -1) return memo;
    }

    var attribute = Model.rawAttributes[key]
      , type = attribute.type;


    if (options.map) {
      if (typeof options.map === 'function') {
        key = options.map(key) || key;
      } else {
        key = options.map[key] || key;
      }
    }

    memo[key] = {
      type: typeMapper.toGraphQL(type, Model.sequelize.constructor)
    };

    if (memo[key].type instanceof GraphQLEnumType ) {
      var typeName = `${Model.name}${key}EnumType`;
      /*
      Cache enum types to prevent duplicate type name error
      when calling attributeFields multiple times on the same model
      */
      if (cache[typeName]) {
        memo[key].type = cache[typeName];
      } else {
        memo[key].type.name = typeName;
        cache[typeName] = memo[key].type;
      }

    }

    if (!options.allowNull) {
      if (attribute.allowNull === false || attribute.primaryKey === true) {
        memo[key].type = new GraphQLNonNull(memo[key].type);
      }
    }

    if (options.commentToDescription) {
      if (typeof attribute.comment === 'string') {
        memo[key].description = attribute.comment;
      }
    }

    return memo;
  }, {});

  if (options.globalId) {
    result.id = globalIdField(Model.name, instance => instance[Model.primaryKeyAttribute]);
  }

  return result;
};
