'use strict';

export function base64(i) {
  return (new Buffer(i, 'ascii')).toString('base64');
}

export function unbase64(i) {
  return (new Buffer(i, 'base64')).toString('ascii');
}
