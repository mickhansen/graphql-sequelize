import { GraphQLList } from 'graphql';
import _ from 'lodash';
import simplifyAST from './simplifyAST';

module.exports = function (target, options) {
  var resolver
    , targetAttributes
    , argsToFindOptions
    , generateIncludes
    , isModel = !!target.getTableName
    , isAssociation = !!target.associationType
    , association = isAssociation && target
    , model = isAssociation && target.target || isModel && target;

  targetAttributes = Object.keys(model.rawAttributes);

  options = options || {};
  if (options.include === undefined) options.include = true;
  if (options.before === undefined) options.before = (options) => options;

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

  generateIncludes = function (simpleAST, type, root) {
    var result = {include: [], attributes: []};

    type = type.ofType || type;

    Object.keys(simpleAST).forEach(function (key) {
      var association
        , includeOptions
        , args = simpleAST[key].args
        , includeResolver = type._fields[key].resolve
        , nestedResult
        , allowedAttributes;

      if (!includeResolver) return;

      if (includeResolver.$proxy) {
        while (includeResolver.$proxy) {
          includeResolver = includeResolver.$proxy;
        }
      }

      if (includeResolver.$passthrough) {
        var dummyResult = generateIncludes(
          simpleAST[key].fields,
          type._fields[key].type,
          root
        );
        result.include = result.include.concat(dummyResult.include);
        return;
      }

      association = includeResolver.$association;

      if (association) {
        includeOptions = argsToFindOptions(args);
        allowedAttributes = Object.keys(association.target.rawAttributes);

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

            result.order = (result.order || []).concat(includeOptions.order);
            delete includeOptions.order;
          }

          includeOptions.attributes = Object.keys(simpleAST[key].fields)
                                      .filter(attribute => ~allowedAttributes.indexOf(attribute));

          includeOptions.attributes.push(association.target.primaryKeyAttribute);

          nestedResult = generateIncludes(
            simpleAST[key].fields,
            type._fields[key].type,
            root
          );

          includeOptions.include = (includeOptions.include || []).concat(nestedResult.include);
          includeOptions.attributes = _.unique(includeOptions.attributes.concat(nestedResult.attributes));

          result.include.push(_.assign({association: association}, includeOptions));
        } else if (association.associationType === 'BelongsTo') {
          result.attributes.push(association.foreignKey);
        } else {
          result.attributes.push(model.primaryKeyAttribute);
        }
      }
    });

    return result;
  };

  resolver = function (source, args, root, ast, type) {
    if (association && source.get(association.as)) {
      return source.get(association.as);
    }

    var list = type instanceof GraphQLList
      , includeResult
      , simpleAST
      , findOptions = argsToFindOptions(args);

    simpleAST = simplifyAST(ast);
    root = root || {};
    type = type.ofType || type;

    findOptions.attributes = Object.keys(simpleAST)
                             .filter(attribute => ~targetAttributes.indexOf(attribute));

    findOptions.attributes.push(model.primaryKeyAttribute);

    includeResult = generateIncludes(simpleAST, type, root);

    findOptions.include = includeResult.include;
    findOptions.root = root;
    findOptions.attributes = _.unique(findOptions.attributes.concat(includeResult.attributes));
    findOptions.logging = findOptions.logging || root.logging;

    if (includeResult.order) {
      findOptions.order = (findOptions.order || []).concat(includeResult.order);
    }

    if (association) {
      return source[association.accessors.get](options.before(findOptions, args, root));
    }
    return model[list ? 'findAll' : 'findOne'](options.before(findOptions, args, root));
  };

  if (association) {
    resolver.$association = association;
  }

  resolver.$before = options.before;

  return resolver;
};
