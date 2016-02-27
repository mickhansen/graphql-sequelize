import chai, {expect} from "chai";
import {replaceWhereOperators} from "../../src/replaceWhereOperators";

describe("replaceWhereOperators", ()=> {
  it("should take an Object of grapqhl-friendly keys and replace with the correct sequelize operators", ()=> {
    let before = {
      and: 1,
      or: "1",
      gt: [{and: "1", or: "1"}, {between: "1", overlap: "1"}],
      gte: 1,
      lt: {
        and: {
          "test": [{or: "1"}]
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
      $and: 1,
      $or: "1",
      $gt: [{$and: "1", $or: "1"}, {$between: "1", $overlap: "1"}],
      $gte: 1,
      $lt: {
        $and: {
          "test": [{$or: "1"}]
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

    expect(replaceWhereOperators(before)).to.deep.equal(after);
  })
});
