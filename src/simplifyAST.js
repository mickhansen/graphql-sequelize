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
  var selections;

  if (ast.selectionSet) selections = ast.selectionSet.selections;
  if (Array.isArray(ast)) selections = ast;

  if (!selections) return {
    fields: {},
    args: {}
  };

  return selections.reduce(function (simpleAST, selection) {
    var name = selection.name.value
      , alias = selection.alias && selection.alias.value
      , key = alias || name;

    simpleAST.fields[key] = simpleAST.fields[key] || {};
    simpleAST.fields[key] = deepMerge(
      simpleAST.fields[key],
      simplyAST(selection, simpleAST.fields[key])
    );

    if (alias) {
      simpleAST.fields[key].key = name;
    }

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
