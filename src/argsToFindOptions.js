import { replaceWhereOperators } from './replaceWhereOperators';

export default function argsToFindOptions(args, targetAttributes) {
  var result = {};

  if (args) {
    Object.keys(args).forEach(function (key) {
      if (typeof args[key] !== 'undefined') {
        if (key === 'limit') {
          result.limit = parseInt(args[key], 10);
        } else if (key === 'offset') {
          result.offset = parseInt(args[key], 10);
        } else if (key === 'order') {
          result.order = [];
          var orders = args[key].split(',');
          orders.map(v => {
            if (v.indexOf('reverse:') === 0) {
              result.order.push([v.substring(8), 'DESC']);
            } else {
              result.order.push([v, 'ASC']);
            }
          });
        } else if (key === 'where') {
          // setup where
          result.where = replaceWhereOperators(args.where);
        } else if (~targetAttributes.indexOf(key)) {
          result.where = result.where || {};
          result.where[key] = args[key];
        }
      }
    });
  }

  return result;
}
