import { GraphQLList } from 'graphql';
import _ from 'lodash';
import simplifyAST from './simplifyAST';
import generateIncludes from './generateIncludes';
import argsToFindOptions from './argsToFindOptions';

module.exports = function (target, options) {
  var resolver
    , targetAttributes
    , isModel = !!target.getTableName
    , isAssociation = !!target.associationType
    , association = isAssociation && target
    , model = isAssociation && target.target || isModel && target;

  targetAttributes = Object.keys(model.rawAttributes);

  options = options || {};
  if (options.include === undefined) options.include = true;
  if (options.before === undefined) options.before = (options) => options;
  if (options.after === undefined) options.after = (result) => result;

  resolver = function (source, args, root, ast, type) {
    if (association && source.get(association.as)) {
      return source.get(association.as);
    }

    var list = type instanceof GraphQLList
      , includeResult
      , simpleAST
      , findOptions = argsToFindOptions(args, model);

    simpleAST = simplifyAST(ast);
    root = root || {};
    type = type.ofType || type;

    findOptions.attributes = Object.keys(simpleAST)
                             .filter(attribute => ~targetAttributes.indexOf(attribute));

    findOptions.attributes.push(model.primaryKeyAttribute);

    includeResult = generateIncludes(simpleAST, type, root, options);

    findOptions.include = includeResult.include;
    findOptions.root = root;
    findOptions.attributes = _.unique(findOptions.attributes.concat(includeResult.attributes));
    findOptions.logging = findOptions.logging || root.logging;

    if (includeResult.order) {
      findOptions.order = (findOptions.order || []).concat(includeResult.order);
    }

    findOptions = options.before(findOptions, args, root, {
      ast: simpleAST,
      type: type
    });

    if (association) {
      return source[association.accessors.get](findOptions).then(function (result) {
        return options.after(result, args, root, {
          ast: simpleAST,
          type: type
        });
      });
    }
    return model[list ? 'findAll' : 'findOne'](findOptions).then(function (result) {
      return options.after(result, args, root, {
        ast: simpleAST,
        type: type
      });
    });
  };

  if (association) {
    resolver.$association = association;
  }

  resolver.$before = options.before;
  resolver.$after = options.after;
  resolver.$options = options;

  return resolver;
};
