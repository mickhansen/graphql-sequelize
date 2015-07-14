import {
  GraphQLList
} from 'graphql';

module.exports = function (target) {
  return (source, args, root, ast, type) => {
    let attributes = ast.selectionSet.selections.map(selection => selection.name.value).filter(attribute => Object.keys(target.rawAttributes).indexOf(attribute) !== -1);
    var list = type instanceof GraphQLList;
    let findOptions = {
      where: args,
      attributes: attributes
    };

    return target[list ? 'findAll' : 'findOne'](findOptions).then(function (result) {
      return list ? result.map(result => result.toJSON()) : result.toJSON();
    });
  };
};
