import {expect} from 'chai';
import {replaceWhereOperators} from '../../src/replaceWhereOperators';
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

describe('replaceWhereOperators', () => {
  it('should take an Object of grapqhl-friendly keys and replace with the correct sequelize operators', ()=> {
    let before = {
      and: 1,
      or: '1',
      gt: [{and: '1', or: '1'}, {between: '1', overlap: '1'}],
      gte: 1,
      lt: {
        and: {
          test: [{or: '1'}]
        }
      },
      lte: 1,
      ne: 1,
      between: 1,
      notBetween: 1,
      in: 1,
      notIn: 1,
      notLike: 1,
      iLike: 1,
      notILike: 1,
      like: 1,
      overlap: 1,
      contains: 1,
      contained: 1,
      any: 1,
      col: 1
    };
    let after = {
      [Op.and]: 1,
      [Op.or]: '1',
      [Op.gt]: [{[Op.and]: '1', [Op.or]: '1'}, {[Op.between]: '1', [Op.overlap]: '1'}],
      [Op.gte]: 1,
      [Op.lt]: {
        [Op.and]: {
          test: [{[Op.or]: '1'}]
        }
      },
      [Op.lte]: 1,
      [Op.ne]: 1,
      [Op.between]: 1,
      [Op.notBetween]: 1,
      [Op.in]: 1,
      [Op.notIn]: 1,
      [Op.notLike]: 1,
      [Op.iLike]: 1,
      [Op.notILike]: 1,
      [Op.like]: 1,
      [Op.overlap]: 1,
      [Op.contains]: 1,
      [Op.contained]: 1,
      [Op.any]: 1,
      [Op.col]: 1
    };

    expect(replaceWhereOperators(before)).to.deep.equal(after);
  });
});
