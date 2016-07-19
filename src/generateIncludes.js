import argsToFindOptions from './argsToFindOptions';
import {isConnection, nodeAST, nodeType} from './relay';
import _ from 'lodash';

const GRAPHQL_NATIVE_KEYS = [
  '__typename',
];

function inList(list, attribute) {
  return ~list.indexOf(attribute);
}

export default function generateIncludes(simpleAST, type, context, options) {
  var result = {include: [], attributes: [], order: []};

  type = type.ofType || type;
  options = options || {};

  return Promise.all(Object.keys(simpleAST.fields).map(function (key) {
    if (inList(GRAPHQL_NATIVE_KEYS, key)) {
      // Skip native grahphql keys
      return;
    }

    var association
      , fieldAST = simpleAST.fields[key]
      , name = fieldAST.key || key
      , fieldType = type._fields[name] && type._fields[name].type
      , includeOptions
      , args = fieldAST.args
      , includeResolver = type._fields[name] && type._fields[name].resolve
      , allowedAttributes
      , include;

    if (!includeResolver) return;

    if (includeResolver.$proxy) {
      while (includeResolver.$proxy) {
        includeResolver = includeResolver.$proxy;
      }
    }

    if (isConnection(fieldType)) {
      fieldAST = nodeAST(fieldAST);
      fieldType = nodeType(fieldType);
    }

    if (!fieldAST) {
      // No point in including if no fields have been asked for
      return;
    }

    if (includeResolver.$passthrough) {
      return generateIncludes(
        fieldAST,
        fieldType,
        context,
        options
      ).then(function (dummyResult) {
        result.include = result.include.concat(dummyResult.include);
        result.attributes = result.attributes.concat(dummyResult.attributes);
        result.order = result.order.concat(dummyResult.order);
      });
    }

    association = includeResolver.$association;
    include = options.include && !(includeResolver.$options && includeResolver.$options.separate);

    if (association) {
      includeOptions = argsToFindOptions(args, association.target);
      allowedAttributes = Object.keys(association.target.rawAttributes);

      if (options.filterAttributes) {
        includeOptions.attributes = (includeOptions.attributes || [])
          .concat(Object.keys(fieldAST.fields).map(key => fieldAST.fields[key].key || key))
          .filter(inList.bind(null, allowedAttributes));
      } else {
        includeOptions.attributes = allowedAttributes;
      }

      return Promise.resolve().then(function () {
        if (includeResolver.$before) {
          return includeResolver.$before(includeOptions, args, context, {
            ast: fieldAST,
            type: type
          });
        }
        return includeOptions;
      }).then(function (includeOptions) {
        if (association.associationType === 'BelongsTo') {
          result.attributes.push(association.foreignKey);
        } else if (association.source.primaryKeyAttribute) {
          result.attributes.push(association.source.primaryKeyAttribute);
        }

        let separate = includeOptions.limit && association.associationType === 'HasMany';

        if (includeOptions.limit) {
          includeOptions.limit = parseInt(includeOptions.limit, 10);
        }

        if (include && (!includeOptions.limit || separate)) {
          if (includeOptions.order && !separate) {
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

          if (association.target.primaryKeyAttribute) {
            includeOptions.attributes.push(association.target.primaryKeyAttribute);
          }

          if (association.associationType === 'HasMany') {
            includeOptions.attributes.push(association.foreignKey);
          }

          return generateIncludes(
            fieldAST,
            fieldType,
            context,
            includeResolver.$options
          ).then(function (nestedResult) {
            includeOptions.include = (includeOptions.include || []).concat(nestedResult.include);
            includeOptions.attributes = _.uniq(includeOptions.attributes.concat(nestedResult.attributes));

            result.include.push(_.assign({association: association}, includeOptions));
          });
        }
      });
    }
  })).then(function () {
    return result;
  });
}
