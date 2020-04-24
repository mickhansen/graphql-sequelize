import sequelizeOps from './sequelizeOps';

/**
 * Replace a key deeply in an object
 * @param obj
 * @param keyMap
 * @returns {Object}
 */
function replaceKeyDeep(obj, keyMap) {
  return Object.getOwnPropertySymbols(obj).concat(Object.keys(obj)).reduce((memo, key)=> {

    // determine which key we are going to use
    let targetKey = keyMap[key] ? keyMap[key] : key;

    if (Array.isArray(obj[key])) {
      // recurse if an array
      memo[targetKey] = obj[key].map((val) => {
        if (Object.prototype.toString.call(val) === '[object Object]') {
          return replaceKeyDeep(val, keyMap);
        }
        return val;
      });
    } else if (Object.prototype.toString.call(obj[key]) === '[object Object]') {
      // recurse if Object
      memo[targetKey] = replaceKeyDeep(obj[key], keyMap);
    } else {
      // assign the new value
      memo[targetKey] = obj[key];
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
export function replaceWhereOperators(where) {
  return replaceKeyDeep(where, sequelizeOps);
}
