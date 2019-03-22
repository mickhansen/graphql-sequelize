'use strict';

export function base64(i) {
  return (Buffer.from(i, 'ascii')).toString('base64');
}

export function unbase64(i) {
  return (Buffer.from(i, 'base64')).toString('ascii');
}
