'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.replaceWhereOperators = replaceWhereOperators;
/**
 * Replace a key deeply in an object
 * @param obj
 * @param keyMap
 * @returns {Object}
 */
function replaceKeyDeep(obj, keyMap) {
  return Object.keys(obj).reduce((memo, key) => {

    // determine which key we are going to use
    let targetKey = keyMap[key] ? keyMap[key] : key;

    // assign the new value
    memo[targetKey] = obj[key];

    // recurse if an array
    if (Array.isArray(memo[targetKey])) {
      memo[targetKey].forEach((val, idx) => {
        if (Object.prototype.toString.call(val) === '[object Object]') {
          memo[targetKey][idx] = replaceKeyDeep(val, keyMap);
        }
      });
    } else if (Object.prototype.toString.call(memo[targetKey]) === '[object Object]') {
      // recurse if Object
      memo[targetKey] = replaceKeyDeep(memo[targetKey], keyMap);
    }

    // return the modified object
    return memo;
  }, {});
}

/**
 * Replace the where arguments object and return the sequelize compatible version.
 * @param where arguments object in GraphQL Safe format meaning no leading "$" chars.
 * @returns {Object}
 */
function replaceWhereOperators(where) {
  return replaceKeyDeep(where, {
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
  });
}