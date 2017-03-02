'use strict';

var _graphql = require('graphql');

var _jsonType = require('./types/jsonType');

var _jsonType2 = _interopRequireDefault(_jsonType);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = function () {
  return {
    limit: {
      type: _graphql.GraphQLInt
    },
    order: {
      type: _graphql.GraphQLString
    },
    where: {
      type: _jsonType2.default,
      description: 'A JSON object conforming the the shape specified in http://docs.sequelizejs.com/en/latest/docs/querying/'
    },
    offset: {
      type: _graphql.GraphQLInt
    }
  };
};