import {cloneDeepWith, mapKeys, mapValues} from 'lodash';

const keyMap = {
  and: '$and',
  or: '$or',
  gt: '$gt',
  gte: '$gte',
  lt: '$lt',
  lte: '$lte',
  ne: '$ne',
  between: '$between',
  notBetween: '$notBetween',
  in: '$in',
  notIn: '$notIn',
  notLike: '$notLike',
  iLike: '$iLike',
  notILike: '$notILike',
  like: '$like',
  overlap: '$overlap',
  contains: '$contains',
  contained: '$contained',
  any: '$any',
  col: '$col'
};

/**
 * Replace the where arguments object and return the sequelize compatible version.
 * @param obj arguments object in GraphQL Safe format meaning no leading "$" chars.
 * @returns {Object}
 */
export function replaceWhereOperators(obj) {
  return cloneDeepWith(obj, field => {
    if (Object.prototype.toString.call(field) === '[object Object]') {
      const fieldWithGoodKeys = mapKeys(field, (v, key) => keyMap[key] || key);
      return mapValues(fieldWithGoodKeys, replaceWhereOperators);
    }
  });
}
