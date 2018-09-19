'use strict';

import { expect } from 'chai';
import argsToFindOptions from '../../src/argsToFindOptions';

describe('argsToFindOptions', function () {
  var targetAttributes = ['order', 'limit', 'offset'];

  it('should return empty with no args or attributes', function () {
    var findOptions = argsToFindOptions(null, null);
    expect(findOptions).to.be.empty;
  });

  it('should not include "order" when present in both args and targetAttributes', function () {
    var findOptions = argsToFindOptions({ where: { property: 1 }, order: 'order' }, targetAttributes);

    expect(findOptions).to.have.ownProperty('where');
    expect(findOptions.where).not.to.have.ownProperty('order');
    expect(findOptions).to.have.ownProperty('order');
    expect(findOptions.order).to.be.an.instanceOf(Array);
  });

  it('should not include "limit" when present in both args targetAttributes', function () {
    var findOptions = argsToFindOptions({ where: { property: 1 }, limit: 1 }, targetAttributes);

    expect(findOptions).to.have.ownProperty('where');
    expect(findOptions.where).not.to.have.ownProperty('limit');
    expect(findOptions).to.have.ownProperty('limit');
    expect(findOptions.limit).to.equal(1);
  });

  it('should not include "offset" when present in both args and targetAttributes', function () {
    var findOptions = argsToFindOptions({ where: { property: 1 }, offset: 1 }, targetAttributes);

    expect(findOptions).to.have.ownProperty('where');
    expect(findOptions.where).not.to.have.ownProperty('offset');
    expect(findOptions).to.have.ownProperty('offset');
    expect(findOptions.offset).to.be.equal(1);
  });
});
