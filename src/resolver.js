import Sequelize from 'sequelize';
import { GraphQLList } from 'graphql';

module.exports = function (target, options) {
  var resolver;

  options = options || {};
  if (options.include === undefined) options.include = true;

  if (target instanceof Sequelize.Model) {
    let targetAttributes = Object.keys(target.rawAttributes);

    resolver = function (source, args, root, ast, type) {
      var selections = ast.selectionSet.selections.map(selection => selection.name.value)
        , attributes = selections
        , include = []
        , list = type instanceof GraphQLList
        , where
        , limit
        , findOptions;

      type = type.ofType || type;

      if (!~attributes.indexOf(target.primaryKeyAttribute)) {
        attributes.push(target.primaryKeyAttribute);
      }

      selections.forEach(function (selection) {
        var association = type._fields[selection].resolve &&
                          type._fields[selection].resolve.$association;

        if (association) {
          if (options.include) {
            include.push(association);
          } else if (association.associationType === 'BelongsTo') {
            if (!~attributes.indexOf(association.foreignKey)) {
              attributes.push(association.foreignKey);
            }
          }
        }
      });

      attributes = attributes.filter(attribute => ~targetAttributes.indexOf(attribute));

      if (args) {
        Object.keys(args).forEach(function (key) {
          if (~targetAttributes.indexOf(key)) {
            where = where || {};
            where[key] = args[key];
          }

          if (key === 'limit') {
            limit = args[key];
          }
        });
      }

      findOptions = {
        where: where,
        limit: limit,
        include: include,
        attributes: attributes
      };

      return target[list ? 'findAll' : 'findOne'](findOptions);
    };
  }

  if (target instanceof require('sequelize/lib/associations/base')) {
    resolver = function (source) {
      return source.get(target.as) || source[target.accessors.get]({

      });
    };

    resolver.$association = target;
  }

  return resolver;
};
