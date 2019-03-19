'use strict';

export function base64(i) {
  return (new Buffer.from(i, 'ascii')).toString('base64');
}

export function unbase64(i) {
  return (new Buffer.from(i, 'base64')).toString('ascii');
}
