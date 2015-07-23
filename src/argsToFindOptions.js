export default function argsToFindOptions(args, target) {
  var result = {}
    , targetAttributes = Object.keys(target.rawAttributes);

  if (args) {
    Object.keys(args).forEach(function (key) {
      if (~targetAttributes.indexOf(key)) {
        result.where = result.where || {};
        result.where[key] = args[key];
      }

      if (key === 'limit' && args[key]) {
        result.limit = args[key];
      }

      if (key === 'order' && args[key]) {
        result.order = [
          [args[key]]
        ];
      }
    });
  }

  return result;
}
