import Sequelize from 'sequelize';
import {
  GraphQLList
} from 'graphql';

module.exports = function (target) {
  if (target instanceof Sequelize.Model) {
    return (source, args, root, ast, type) => {
      return target[type instanceof GraphQLList ? 'findAll' : 'findOne']({
        where: args
      });
    };
  }

  if (target instanceof require('sequelize/lib/associations/base')) {
    return (source) => {
      return source[target.accessors.get]();
    };
  }
};
