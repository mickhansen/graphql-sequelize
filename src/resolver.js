import { GraphQLList } from 'graphql';
import _ from 'lodash';

module.exports = function (target, options) {
  var resolver
    , targetAttributes
    , argsToFindOptions;

  targetAttributes = target.getTableName ?
                     Object.keys(target.rawAttributes) :
                     Object.keys(target.target.rawAttributes);

  argsToFindOptions = function (args) {
    var result = {};

    if (args) {
      Object.keys(args).forEach(function (key) {
        if (~targetAttributes.indexOf(key)) {
          result.where = result.where || {};
          result.where[key] = args[key];
        }

        if (key === 'limit' && args[key]) {
          result.limit = args[key];
        }

        if (key === 'order' && args[key]) {
          result.order = [
            [args[key]]
          ];
        }
      });
    }

    result.logging = options.logging;
    return result;
  };

  options = options || {};
  if (options.include === undefined) options.include = true;
  if (options.before === undefined) options.before = (options) => options;

  if (target.getTableName) {
    resolver = function (source, args, root, ast, type) {
      var selections
        , attributes
        , include = []
        , list = type instanceof GraphQLList
        , findOptions = argsToFindOptions(args);

      root = root || {};
      type = type.ofType || type;

      selections = ast.selectionSet.selections.reduce(function (memo, selection) {
        memo[selection.name.value] = selection;
        return memo;
      }, {});

      attributes = Object.keys(selections)
                         .filter(attribute => ~targetAttributes.indexOf(attribute));

      if (!~attributes.indexOf(target.primaryKeyAttribute)) {
        attributes.push(target.primaryKeyAttribute);
      }

      Object.keys(selections).forEach(function (key) {
        var association
          , includeOptions
          , args
          , includeResolver = type._fields[key].resolve;

        if (includeResolver && includeResolver.$proxy) {
          while (includeResolver.$proxy) {
            includeResolver = includeResolver.$proxy;
          }
        }

        association = includeResolver &&
                      includeResolver.$association;

        if (association) {
          args = selections[key].arguments.reduce(function (memo, arg) {
            memo[arg.name.value] = arg.value.value;
            return memo;
          }, {});

          includeOptions = argsToFindOptions(args);

          if (includeResolver.$before) {
            includeOptions = includeResolver.$before(includeOptions, args, root);
          }

          if (options.include && !includeOptions.limit) {
            if (includeOptions.order) {
              includeOptions.order.map(function (order) {
                order.unshift({
                  model: association.target,
                  as: association.options.as
                });

                return order;
              });

              findOptions.order = (findOptions.order || []).concat(includeOptions.order);

              delete includeOptions.order;
            }

            include.push(_.assign({association: association}, includeOptions));
          } else if (association.associationType === 'BelongsTo') {
            if (!~attributes.indexOf(association.foreignKey)) {
              attributes.push(association.foreignKey);
            }
          }
        }
      });

      findOptions.include = include;
      findOptions.attributes = attributes;
      findOptions.root = root;
      findOptions.logging = findOptions.logging || root.logging;

      return target[list ? 'findAll' : 'findOne'](options.before(findOptions, args, root));
    };
  }

  if (target.associationType) {
    resolver = function (source, args, root) {
      if (source.get(target.as)) {
        return source.get(target.as);
      }

      root = root || {};

      var findOptions = argsToFindOptions(args);
      findOptions.root = root;
      findOptions.logging = findOptions.logging || root.logging;

      return source[target.accessors.get](options.before(findOptions, args, root));
    };

    resolver.$association = target;
  }

  resolver.$before = options.before;

  return resolver;
};
