import {
  fromGlobalId,
  connectionFromArray,
  nodeDefinitions,
  connectionDefinitions,
  connectionArgs
} from 'graphql-relay';

import {
  GraphQLList,
  GraphQLEnumType
} from 'graphql';

import {
  base64,
  unbase64,
} from './base64.js';

import _ from 'lodash';
import resolver from './resolver';

class NodeTypeMapper {

  constructor( sequelize ) {
    this.models = Object.keys(sequelize.models);
    this.models.forEach(model => {
      this[model] = null;
    });
  }

  mapTypes( types ) {
    Object.keys(types).forEach(type => {
      this[type] = types[type];
    });
  }
}

export function idFetcher(sequelize, nodeTypeMapper) {
  return globalId => {
    let {type, id} = fromGlobalId(globalId);
    const models = Object.keys(sequelize.models);
    if (models.some(model => model === type)) {
      return sequelize.models[type].findById(id);
    }
    if (nodeTypeMapper[type]) {
      return nodeTypeMapper[type];
    }
    return null;
  };
}

export function isConnection(type) {
  return typeof type.name !== 'undefined' && type.name.endsWith('Connection');
}

export function handleConnection(values, args) {
  return connectionFromArray(values, args);
}

export function sequelizeNodeInterface(sequelize) {
  let nodeTypeMapper = new NodeTypeMapper(sequelize);
  const nodeObjects = nodeDefinitions(idFetcher(sequelize, nodeTypeMapper), obj => {
    var name = obj.Model
            ? obj.Model.options.name.singular
            : obj.name;
    return nodeTypeMapper[name];
  });
  return {
    nodeTypeMapper,
    ...nodeObjects
  };
}

export function nodeAST(connectionAST) {
  return connectionAST.fields.edges.fields.node;
}

export function nodeType(connectionType) {
  return connectionType._fields.edges.type.ofType._fields.node.type;
}

export function sequelizeConnection({name, nodeType, target, orderBy}) {
  const {
    edgeType,
    connectionType
  } = connectionDefinitions({name: name, nodeType: nodeType});

  const model = target.target ? target.target : target;

  const SEPERATOR = '$';
  const PREFIX = 'arrayconnection' + SEPERATOR;

  if (orderBy === undefined) {
    orderBy = new GraphQLList(new GraphQLEnumType({
      name: name + 'ConnectionOrder',
      values: {
        ID: [model.primaryKeyAttribute, 'ASC']
      }
    }));
  }

  let $connectionArgs = {
    ...connectionArgs,
    orderBy: {
      type: new GraphQLList(orderBy)
    }
  };

  let resolve = resolver(target, {
    handleConnection: false,
    before: function (options, args) {
      if (args.first || args.last) {
        options.limit = parseInt(args.first || args.last, 10);
      }

      if (!args.orderBy) {
        args.orderBy = orderBy.values[0].value;
      }

      let orderBy = args.orderBy;
      let orderAttribute = orderByAttribute(orderBy);
      let orderDirection = args.orderBy[0][1];

      if (args.last) {
        orderDirection = orderDirection === 'ASC' ? 'DESC' : 'ASC';
      }

      options.order = [
        [orderAttribute, orderDirection]
      ];

      if (orderByAttribute !== model.primaryKeyAttribute) {
        options.order.push([model.primaryKeyAttribute, 'ASC']);
      }

      options.attributes.push(orderAttribute);

      if (model.sequelize.dialect.name === 'postgres') {
        options.attributes.push([
          model.sequelize.literal('COUNT(*) OVER()'),
          'full_count'
        ]);
      }

      if (args.after || args.before) {
        let cursor = fromCursor(args.after || args.before);
        let orderValue = cursor.orderValue;

        if (model.rawAttributes[orderAttribute].type instanceof model.sequelize.constructor.DATE) {
          orderValue = new Date(orderValue);
        }

        options.where = options.where || {};

        let where = {
          $or: [
            {
              [orderByAttribute(orderBy)]: {
                [orderDirection === 'ASC' ? '$gt' : '$lt']: orderValue
              }
            },
            {
              [orderByAttribute(orderBy)]: {
                $eq: orderValue
              },
              [model.primaryKeyAttribute]: {
                [orderDirection === 'ASC' ? '$gt' : '$lt']: cursor.id
              }
            }
          ]
        };

        // TODO, do a proper merge that won't kill another $or
        _.assign(options.where, where);
      }

      return options;
    }
  });

  let orderByAttribute = function (orderBy) {
    return orderBy[0][0];
  };

  let toCursor = function (value, orderBy) {
    let id = value.get(model.primaryKeyAttribute);
    let orderValue = value.get(orderByAttribute(orderBy));
    return base64(PREFIX + id + SEPERATOR + orderValue);
  };

  let fromCursor = function (cursor) {
    cursor = unbase64(cursor);
    cursor = cursor.substring(PREFIX.length, cursor.length);
    let [id, orderValue] = cursor.split(SEPERATOR);

    return {
      id,
      orderValue
    };
  };

  return {
    connectionType,
    edgeType,
    nodeType,
    connectionArgs: $connectionArgs,
    resolve: function (source, args, info) {
      return resolve(source, args, info).then(function (values) {
        let edges = values.map((value) => {
          return {
            cursor: toCursor(value, args.orderBy),
            node: value
          };
        });

        let firstEdge = edges[0];
        let lastEdge = edges[edges.length - 1];
        let fullCount = values[0].dataValues.full_count && parseInt(values[0].dataValues.full_count, 10) || 0;

        return {
          edges,
          pageInfo: {
            startCursor: firstEdge ? firstEdge.cursor : null,
            endCursor: lastEdge ? lastEdge.cursor : null,
            hasPreviousPage: args.last != null ? fullCount > parseInt(args.last, 10) : false,
            hasNextPage: args.first != null ? fullCount > parseInt(args.first, 10) : false,
          }
        };
      });
    }
  };
}
