import * as typeMapper from './typeMapper';
import { GraphQLNonNull, GraphQLEnumType } from 'graphql';
import { globalIdField } from 'graphql-relay';

module.exports = function (Model, options = {}) {
  var result = Object.keys(Model.rawAttributes).reduce(function (memo, key) {
    if (options.exclude && ~options.exclude.indexOf(key)) return memo;
    if (options.only && !~options.only.indexOf(key)) return memo;

    var attribute = Model.rawAttributes[key]
      , type = attribute.type;


    if (options.map) {
      if (typeof options.map === 'function') {
        key = options.map(key) || key;
      } else {
        key = options.map[key] || key;
      }
    }

    let graphQLType;
    if (options.typeMapper) {
      graphQLType = options.typeMapper(key, type, Model.sequelize.constructor);
    }
    graphQLType = graphQLType || typeMapper.toGraphQL(type, Model.sequelize.constructor);

    memo[key] = {
      type: graphQLType
    };

    if (graphQLType instanceof GraphQLEnumType ) {
      graphQLType.name = `${Model.name}${key}EnumType`;
    }

    if (!options.allowNull) {
      if (attribute.allowNull === false || attribute.primaryKey === true) {
        graphQLType = new GraphQLNonNull(graphQLType);
      }
    }

    memo[key].type = graphQLType;

    return memo;
  }, {});

  if (options.globalId) {
    result.id = globalIdField(Model.name, instance => instance[Model.primaryKeyAttribute]);
  }

  return result;
};
