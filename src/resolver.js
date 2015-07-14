import {
  GraphQLList
} from 'graphql';

module.exports = function (target) {
  var targetAttributes = Object.keys(target.rawAttributes);

  return (source, args, root, ast, type) => {
    let attributes = ast.selectionSet.selections
                     .map(selection => selection.name.value)
                     .filter(attribute => attribute in targetAttributes);

    var list = type instanceof GraphQLList;
    let findOptions = {
      where: args,
      attributes: attributes
    };

    return target[list ? 'findAll' : 'findOne'](findOptions).then(function (result) {
      return list ? result.map(item => item.toJSON()) : result.toJSON();
    });
  };
};
