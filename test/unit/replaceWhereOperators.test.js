import {expect} from 'chai';
import {replaceWhereOperators} from '../../src/replaceWhereOperators';
import {Sequelize} from 'sequelize';

const [seqMajVer] = Sequelize.version.split('.');

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

    let after;
    if (seqMajVer <= 3) {
      after = {
        $and: 1,
        $or: '1',
        $gt: [{$and: '1', $or: '1'}, {$between: '1', $overlap: '1'}],
        $gte: 1,
        $lt: {
          $and: {
            test: [{$or: '1'}]
          }
        },
        $lte: 1,
        $ne: 1,
        $between: 1,
        $notBetween: 1,
        $in: 1,
        $notIn: 1,
        $notLike: 1,
        $iLike: 1,
        $notILike: 1,
        $like: 1,
        $overlap: 1,
        $contains: 1,
        $contained: 1,
        $any: 1,
        $col: 1
      };
    } else {
      after = {
        [Sequelize.Op.and]: 1,
        [Sequelize.Op.or]: '1',
        [Sequelize.Op.gt]: [
          {
            [Sequelize.Op.and]: '1',
            [Sequelize.Op.or]: '1'
          },
          {
            [Sequelize.Op.between]: '1',
            [Sequelize.Op.overlap]: '1'
          }
        ],
        [Sequelize.Op.gte]: 1,
        [Sequelize.Op.lt]: {
          [Sequelize.Op.and]: {
            test: [{[Sequelize.Op.or]: '1'}]
          }
        },
        [Sequelize.Op.lte]: 1,
        [Sequelize.Op.ne]: 1,
        [Sequelize.Op.between]: 1,
        [Sequelize.Op.notBetween]: 1,
        [Sequelize.Op.in]: 1,
        [Sequelize.Op.notIn]: 1,
        [Sequelize.Op.notLike]: 1,
        [Sequelize.Op.iLike]: 1,
        [Sequelize.Op.notILike]: 1,
        [Sequelize.Op.like]: 1,
        [Sequelize.Op.overlap]: 1,
        [Sequelize.Op.contains]: 1,
        [Sequelize.Op.contained]: 1,
        [Sequelize.Op.any]: 1,
        [Sequelize.Op.col]: 1
      };

    }
    expect(replaceWhereOperators(before)).to.deep.equal(after);
  });
});
