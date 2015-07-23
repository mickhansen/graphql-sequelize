import _ from 'lodash';

function deepMerge(a, b) {
  return _.merge(a, b, function (a, b) {
    if (a && a.fields && b && b.fields) {
      a.fields = deepMerge(a.fields, b.fields);
      return a;
    }
    return a && a.fields && a || b && b.fields && b;
  });
}

module.exports = function simplyAST(ast, parent) {
  if (!ast.selectionSet) return {
    fields: {},
    args: {}
  };

  return ast.selectionSet.selections.reduce(function (simpleAST, selection) {
    var key = selection.name.value;

    simpleAST.fields[key] = simpleAST.fields[key] || {};
    simpleAST.fields[key] = deepMerge(
      simpleAST.fields[key],
      simplyAST(selection, simpleAST.fields[key])
    );

    simpleAST.fields[key].args = selection.arguments.reduce(function (args, arg) {
      args[arg.name.value] = arg.value.value;
      return args;
    }, {});

    if (parent) {
      Object.defineProperty(simpleAST.fields[key], '$parent', { value: parent, enumerable: false });
    }

    return simpleAST;
  }, {
    fields: {},
    args: {}
  });
};
