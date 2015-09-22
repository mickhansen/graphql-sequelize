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

function hasFragments(info) {
  return info.fragments && Object.keys(info.fragments).length > 0;
}

function isFragment(info, ast) {
  return hasFragments(info) && info.fragments[ast.name.value] && ast.kind !== 'FragmentDefinition';
}

module.exports = function simplyAST(ast, info, parent) {
  var selections;
  info = info || {};

  if (ast.selectionSet) selections = ast.selectionSet.selections;
  if (Array.isArray(ast)) selections = ast;

  if (isFragment(info, ast)) {
    return simplyAST(info.fragments[ast.name.value], info);

  }

  if (!selections) return {
    fields: {},
    args: {}
  };

  return selections.reduce(function (simpleAST, selection) {
    var name = selection.name.value
      , alias = selection.alias && selection.alias.value
      , key = alias || name;

    if (selection.kind === 'FragmentSpread') {
      simpleAST = deepMerge(
        simpleAST, simplyAST(selection, info)
      );
      return simpleAST;
    }

    simpleAST.fields[key] = simpleAST.fields[key] || {};
    simpleAST.fields[key] = deepMerge(
      simpleAST.fields[key], simplyAST(selection, info, simpleAST.fields[key])
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
