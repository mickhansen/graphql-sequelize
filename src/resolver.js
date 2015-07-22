import { GraphQLList } from 'graphql';
import _ from 'lodash';

module.exports = function (target, options) {
  var resolver
    , targetAttributes
    , argsToFindOptions
    , parseSelectionSet
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

  parseSelectionSet = function (selectionSet) {
    return selectionSet.selections.reduce(function (memo, selection) {
      memo[selection.name.value] = selection;
      return memo;
    }, {});
  };

  generateIncludes = function (selections, type, root) {
    var result = {include: [], attributes: []};

    type = type.ofType || type;

    Object.keys(selections).forEach(function (key) {
      var association
        , includeOptions
        , args
        , includeResolver = type._fields[key].resolve
        , includeSelections
        , nestedResult
        , allowedAttributes;

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

          includeSelections = parseSelectionSet(selections[key].selectionSet);
          includeOptions.attributes = Object.keys(includeSelections)
                                      .filter(attribute => ~allowedAttributes.indexOf(attribute));

          nestedResult = generateIncludes(
            includeSelections,
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

    var selections
      , list = type instanceof GraphQLList
      , includeResult
      , findOptions = argsToFindOptions(args);

    root = root || {};
    type = type.ofType || type;

    selections = parseSelectionSet(ast.selectionSet);

    findOptions.attributes = Object.keys(selections)
                             .filter(attribute => ~targetAttributes.indexOf(attribute));

    includeResult = generateIncludes(selections, type, root);

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
