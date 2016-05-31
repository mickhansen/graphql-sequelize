import { GraphQLList } from 'graphql';
import _ from 'lodash';
import simplifyAST from './simplifyAST';
import generateIncludes from './generateIncludes';
import argsToFindOptions from './argsToFindOptions';
import { isConnection, handleConnection, nodeAST, nodeType } from './relay';
import invariant from 'invariant';

function inList(list, attribute) {
  return ~list.indexOf(attribute);
}

function validateOptions(options) {
  invariant(
    !options.defaultAttributes || Array.isArray(options.defaultAttributes),
    'options.defaultAttributes must be an array of field names.'
  );
}

function resolverFactory(target, options) {
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
  if (options.handleConnection === undefined) options.handleConnection = true;
  if (options.filterAttributes === undefined) options.filterAttributes = resolverFactory.filterAttributes;

  validateOptions(options);

  resolver = function (source, args, context, info) {
    var ast = info.fieldASTs
      , type = info.returnType
      , list = options.list || type instanceof GraphQLList
      , simpleAST = simplifyAST(ast[0], info)
      , fields = simpleAST.fields
      , findOptions = argsToFindOptions(args, model);

    context = context || {};

    if (isConnection(info.returnType)) {
      simpleAST = nodeAST(simpleAST);
      fields = simpleAST.fields;

      type = nodeType(type);
    }

    type = type.ofType || type;

    if (association && source.get(association.as) !== undefined) {
      if (options.handleConnection && isConnection(info.returnType)) {
        return handleConnection(source.get(association.as), args);
      }

      return options.after(source.get(association.as), args, context, {
        ...info,
        ast: simpleAST,
        type: type,
        source: source
      });
    }

    if (options.filterAttributes) {
      findOptions.attributes = Object.keys(fields)
        .map(key => fields[key].key || key)
        .filter(inList.bind(null, targetAttributes));

      if (options.defaultAttributes) {
        findOptions.attributes = findOptions.attributes.concat(options.defaultAttributes);
      }

    } else {
      findOptions.attributes = targetAttributes;
    }

    if (model.primaryKeyAttribute) {
      findOptions.attributes.push(model.primaryKeyAttribute);
    }

    return generateIncludes(
      simpleAST,
      type,
      context,
      options
    ).then(function (includeResult) {
      findOptions.include = includeResult.include;
      if (includeResult.order) {
        findOptions.order = (findOptions.order || []).concat(includeResult.order);
      }
      findOptions.attributes = _.uniq(findOptions.attributes.concat(includeResult.attributes));

      findOptions.root = context;
      findOptions.context = context;
      findOptions.logging = findOptions.logging || context.logging;

      return options.before(findOptions, args, context, {
        ...info,
        ast: simpleAST,
        type: type,
        source: source
      });
    }).then(function (findOptions) {
      if (list && !findOptions.order) {
        findOptions.order = [model.primaryKeyAttribute, 'ASC'];
      }

      if (association) {
        return source[association.accessors.get](findOptions).then(function (result) {
          if (options.handleConnection && isConnection(info.returnType)) {
            return handleConnection(result, args);
          }
          return result;
        });
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

  if (association) {
    resolver.$association = association;
  }

  resolver.$before = options.before;
  resolver.$after = options.after;
  resolver.$options = options;

  return resolver;
}

resolverFactory.filterAttributes = true;

module.exports = resolverFactory;
