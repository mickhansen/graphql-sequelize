import {
  GraphQLList
} from 'graphql';

module.exports = function (target) {
  var targetAttributes = Object.keys(target.rawAttributes);

  return (source, args, root, ast, type) => {
    let attributes = ast.selectionSet.selections
                     .map(selection => selection.name.value)
                     .filter(attribute => ~targetAttributes.indexOf(attribute));

    let list = type instanceof GraphQLList;
    let findOptions = {
      where: args,
      attributes: attributes
    };
    return target[list ? 'findAll' : 'findOne'](findOptions).then(function (result) {
      if (list) return result.map(item => item.toJSON());
      return result.toJSON();
    }).then(function (result) {
      return result;
    });
  };
};
