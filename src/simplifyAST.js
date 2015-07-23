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
  if (!ast.selectionSet) return undefined;

  return ast.selectionSet.selections.reduce(function (memo, selection) {
    var key = selection.name.value
      , fields;

    memo[key] = memo[key] || {};
    fields = simplyAST(selection, memo[key]);

    if (fields) {
      memo[key].args = selection.arguments.reduce(function (memo, arg) {
        memo[arg.name.value] = arg.value.value;
        return memo;
      }, {});
    }

    if (fields) {
      memo[key].fields = deepMerge(memo[key].fields || {}, fields);
    }

    if (parent) {
      Object.defineProperty(memo[key], '$parent', { value: parent, enumerable: false });
    }

    return memo;
  }, {});
};
