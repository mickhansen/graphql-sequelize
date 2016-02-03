import argsToFindOptions from './argsToFindOptions';
import {isConnection, nodeAST, nodeType} from './relay';
import _ from 'lodash';

function inList(list, attribute) {
  return ~list.indexOf(attribute);
}

export default function generateIncludes(simpleAST, type, root, options) {
  var result = {include: [], attributes: [], order: []};

  type = type.ofType || type;
  options = options || {};

  Object.keys(simpleAST.fields).forEach(function (key) {
    var association
      , fieldAST = simpleAST.fields[key]
      , name = fieldAST.key || key
      , fieldType = type._fields[name] && type._fields[name].type
      , includeOptions
      , args = fieldAST.args
      , includeResolver = type._fields[name].resolve
      , nestedResult
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
      // No point in ncluding if no fields have been asked for
      return;
    }

    if (includeResolver.$passthrough) {
      var dummyResult = generateIncludes(
        fieldAST,
        fieldType,
        root,
        options
      );

      result.include = result.include.concat(dummyResult.include);
      result.attributes = result.attributes.concat(dummyResult.attributes);
      result.order = result.order.concat(dummyResult.order);
      return;
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

      if (includeResolver.$before) {
        includeOptions = includeResolver.$before(includeOptions, args, root, {
          ast: fieldAST,
          type: type
        });
      }

      if (association.associationType === 'BelongsTo') {
        result.attributes.push(association.foreignKey);
      } else if (association.source.primaryKeyAttribute) {
        result.attributes.push(association.source.primaryKeyAttribute);
      }

      let separate = includeOptions.limit && association.associationType === 'HasMany';

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

        nestedResult = generateIncludes(
          fieldAST,
          fieldType,
          root,
          includeResolver.$options
        );

        includeOptions.include = (includeOptions.include || []).concat(nestedResult.include);
        includeOptions.attributes = _.uniq(includeOptions.attributes.concat(nestedResult.attributes));

        result.include.push(_.assign({association: association}, includeOptions));
      }
    }
  });

  return result;
}
