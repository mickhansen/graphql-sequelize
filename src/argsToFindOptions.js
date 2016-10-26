import {replaceWhereOperators} from './replaceWhereOperators';

export default function argsToFindOptions(args, targetAttributes) {
  var result = {};

  if (args) {
    Object.keys(args).forEach(function (key) {
      if (~targetAttributes.indexOf(key)) {
        result.where = result.where || {};
        result.where[key] = args[key];
      }

      if (key === 'limit' && args[key]) {
        result.limit = parseInt(args[key], 10);
      }

      if (key === 'offset' && args[key]) {
        result.offset = parseInt(args[key], 10);
      }

      if (key === 'order' && args[key]) {
        result.order = result.order || [];
        result.order = args[key];
      }

      if (key === 'where' && args[key]) {
        // setup where
        result.where = replaceWhereOperators(args.where);
      }

    });
  }

  return result;
}
