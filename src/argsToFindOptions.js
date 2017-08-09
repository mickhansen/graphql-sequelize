import _ from 'lodash';
import {replaceWhereOperators} from './replaceWhereOperators';

function fulfillIncludesWithModels(includes, model, allowedIncludes = {}) {
  if (!includes) return;
  if (!_.isArray(includes)) throw Error(`include must be an Array but got ${JSON.stringify(includes)}`);
  includes.forEach(included => {
    if (_.isString(included.model)) {
      const includedModelName = allowedIncludes[included.model];
      if (!includedModelName) throw Error(`model "${model.name}" has no allowance to include "${included.model}"`);

      const association = _.find(model.associations, a => a.target.name === includedModelName);
      if (!association) throw Error(`model "${model.name}" is not associate with "${included.model}"`);

      included.model = association.target;
      included.as = association.options.as;
      included.required = true;
      fulfillIncludesWithModels(included.include, association.target, allowedIncludes);
    }
  });
}

export default function argsToFindOptions(args, targetAttributes, model, allowedIncludes) {
  const result = {};

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
        if (args[key].indexOf('reverse:') === 0) {
          result.order = [[args[key].substring(8), 'DESC']];
        } else {
          result.order = [[args[key], 'ASC']];
        }
      }

      if (key === 'where' && args[key]) {
        result.where = replaceWhereOperators(args.where);
      }

      if (key === 'include' && args[key]) {
        result.include = replaceWhereOperators(args.include);
        fulfillIncludesWithModels(result.include, model, allowedIncludes);
      }

    });
  }

  return result;
}
