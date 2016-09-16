import { GraphQLList } from 'graphql';
import simplifyAST from './simplifyAST';
import argsToFindOptions from './argsToFindOptions';
import { isConnection, handleConnection, nodeAST, nodeType } from './relay';
import invariant from 'assert';
import Promise from 'bluebird';
import dataLoaderSequelize from 'dataloader-sequelize';

function validateOptions(options) {
  invariant(
    !options.defaultAttributes || Array.isArray(options.defaultAttributes),
    'options.defaultAttributes must be an array of field names.'
  );
}

function resolverFactory(target, options) {
  dataLoaderSequelize(target);

  var resolver
    , targetAttributes
    , isModel = !!target.getTableName
    , isAssociation = !!target.associationType
    , association = isAssociation && target
    , model = isAssociation && target.target || isModel && target;

  targetAttributes = Object.keys(model.rawAttributes);

  options = options || {};

  invariant(options.include === undefined, 'Include support has been removed in favor of dataloader batching');
  if (options.before === undefined) options.before = (options) => options;
  if (options.after === undefined) options.after = (result) => result;
  if (options.handleConnection === undefined) options.handleConnection = true;

  validateOptions(options);

  resolver = function (source, args, context, info) {
    var ast = info.fieldASTs
      , type = info.returnType
      , list = options.list || type instanceof GraphQLList
      , simpleAST = simplifyAST(ast, info)
      , findOptions = argsToFindOptions(args, model);

    context = context || {};

    if (isConnection(info.returnType)) {
      simpleAST = nodeAST(simpleAST);

      type = nodeType(type);
    }

    type = type.ofType || type;

    findOptions.attributes = targetAttributes;

    findOptions.root = context;
    findOptions.context = context;
    findOptions.logging = findOptions.logging || context.logging;

    return Promise.resolve(options.before(findOptions, args, context, {
      ...info,
      ast: simpleAST,
      type: type,
      source: source
    })).then(function (findOptions) {
      if (list && !findOptions.order) {
        findOptions.order = [[model.primaryKeyAttribute, 'ASC']];
      }

      if (association) {
        if (source.get(association.as) !== undefined) {
          // The user did a manual include
          // TODO test this!
          const result = source.get(association.as);
          if (options.handleConnection && isConnection(info.returnType)) {
            return handleConnection(result, args);
          }

          return result;
        } else {
          return source[association.accessors.get](findOptions).then(function (result) {
            if (options.handleConnection && isConnection(info.returnType)) {
              return handleConnection(result, args);
            }
            return result;
          });
        }
      }

      return model[list ? 'findAll' : 'findOne'](findOptions);
    }).then(function (result) {
      return options.after(result, args, context, {
        ...info,
        ast: simpleAST,
        type: type,
        source: source
      });
    });
  };

  return resolver;
}

module.exports = resolverFactory;
