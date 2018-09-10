import {Sequelize} from 'sequelize';
import {transform} from 'lodash';
const [seqMajVer] = Sequelize.version.split('.');
let ops;

if (seqMajVer <= 3) {
  ops = {
    eq: '$eq',
    ne: '$ne',
    gte: '$gte',
    gt: '$gt',
    lte: '$lte',
    lt: '$lt',
    not: '$not',
    in: '$in',
    notIn: '$notIn',
    is: '$is',
    like: '$like',
    notLike: '$notLike',
    iLike: '$iLike',
    notILike: '$notILike',
    regexp: '$regexp',
    notRegexp: '$notRegexp',
    iRegexp: '$iRegexp',
    notIRegexp: '$notIRegexp',
    between: '$between',
    notBetween: '$notBetween',
    overlap: '$overlap',
    contains: '$contains',
    contained: '$contained',
    adjacent: '$adjacent',
    strictLeft: '$strictLeft',
    strictRight: '$strictRight',
    noExtendRight: '$noExtendRight',
    noExtendLeft: '$noExtendLeft',
    and: '$and',
    or: '$or',
    any: '$any',
    all: '$all',
    values: '$values',
    col: '$col',
    raw: '$raw'
  };
} else {
  ops = transform(Sequelize.Op, (o, v, k) => {
    if (typeof v !== 'symbol') {
      return;
    }
    o[k] = v;
  });
}

export default ops;
