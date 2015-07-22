import _ from 'lodash';

function deepMerge(a, b) {
  return _.merge(a, b, function (a, b) {
    if (a && a.fields && b && b.fields) {
      a.fields = deepMerge(a.fields, b.fields);
      return a;
    }
  });
}

module.exports = function simplyAST(ast) {
  if (!ast.selectionSet) return undefined;

  return ast.selectionSet.selections.reduce(function (memo, selection) {
    var key = selection.name.value
      , fields = simplyAST(selection);

    memo[key] = memo[key] || {};

    if (fields) {
      memo[key].args = selection.arguments.reduce(function (memo, arg) {
        memo[arg.name.value] = arg.value.value;
        return memo;
      }, {});
    }

    if (fields) {
      memo[key].fields = deepMerge(memo[key].fields || {}, fields);
    }

    return memo;
  }, {});
};
