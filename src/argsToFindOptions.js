import { replaceWhereOperators } from './replaceWhereOperators';

export default function argsToFindOptions(args, targetAttributes) {
  var result = {};

  if (args) {
    Object.keys(args).forEach(function (key) {
      if (key === 'limit' && args[key]) {
        result.limit = parseInt(args[key], 10);
      } else if (key === 'offset' && args[key]) {
        result.offset = parseInt(args[key], 10);
      } else if (key === 'order' && args[key]) {
        if (args[key].indexOf('reverse:') === 0) {
          result.order = [[args[key].substring(8), 'DESC']];
        } else {
          result.order = [[args[key], 'ASC']];
        }
      } else if (key === 'where' && args[key]) {
        // setup where
        result.where = replaceWhereOperators(args.where);
      } else if (~targetAttributes.indexOf(key)) {
        result.where = result.where || {};
        result.where[key] = args[key];
      }
    });
  }

  return result;
}
