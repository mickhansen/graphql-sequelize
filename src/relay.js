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
import simplifyAST from './simplifyAST';

class NodeTypeMapper {
  constructor(sequelize) {
    this.models = Object.keys(sequelize.models);
    this.models.forEach(model => {
      this[model] = null;
    });
  }

  mapTypes(types) {
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

export function typeResolver(nodeTypeMapper) {
  return obj => {
    var name = obj.Model
      ? obj.Model.options.name.singular
      : obj.name;

    return nodeTypeMapper[name];
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
  const nodeObjects = nodeDefinitions(
    idFetcher(sequelize, nodeTypeMapper),
    typeResolver(nodeTypeMapper)
  );

  return {
    nodeTypeMapper,
    ...nodeObjects
  };
}

export function nodeAST(connectionAST) {
  return connectionAST.fields.edges &&
    connectionAST.fields.edges.fields.node;
}

export function nodeType(connectionType) {
  return connectionType._fields.edges.type.ofType._fields.node.type;
}

export function sequelizeConnection({name, nodeType, target, orderBy: orderByEnum, before, connectionFields, edgeFields, where}) {
  const {
    edgeType,
    connectionType
    } = connectionDefinitions({
      name,
      nodeType,
      connectionFields,
      edgeFields
    });

  const model = target.target ? target.target : target;
  const SEPERATOR = '$';
  const PREFIX = 'arrayconnection' + SEPERATOR;

  if (orderByEnum === undefined) {
    orderByEnum = new GraphQLEnumType({
      name: name + 'ConnectionOrder',
      values: {
        ID: {value: [model.primaryKeyAttribute, 'ASC']}
      }
    });
  }

  let defaultOrderBy = orderByEnum._values[0].value;

  before = before || ((options) => options);

  let $connectionArgs = {
    ...connectionArgs,
    orderBy: {
      type: new GraphQLList(orderByEnum)
    }
  };

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

  let argsToWhere = function (args) {
    let result = {};

    _.each(args, (value, key) => {
      if (key in $connectionArgs) return;
      _.assign(result, where(key, value));
    });

    return result;
  };

  let resolveEdge = function (item, args = {}, source) {
    if (!args.orderBy) {
      args.orderBy = [defaultOrderBy];
    }

    return {
      cursor: toCursor(item, args.orderBy),
      node: item,
      source: source
    };
  };

  let $resolver = require('./resolver')(target, {
    handleConnection: false,
    include: true,
    list: true,
    before: function (options, args, root, context) {
      if (args.first || args.last) {
        options.limit = parseInt(args.first || args.last, 10);
      }

      if (!args.orderBy) {
        args.orderBy = [orderByEnum._values[0].value];
      } else if (typeof args.orderBy === 'string') {
        args.orderBy = [orderByEnum._nameLookup[args.orderBy].value];
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

      if (orderAttribute !== model.primaryKeyAttribute) {
        options.order.push([model.primaryKeyAttribute, 'ASC']);
      }

      options.attributes.push(orderAttribute);

      if (model.sequelize.dialect.name === 'postgres' && options.limit) {
        options.attributes.push([
          model.sequelize.literal('COUNT(*) OVER()'),
          'full_count'
        ]);
      }

      options.where = argsToWhere(args);
      options.required = false;

      if (args.after || args.before) {
        let cursor = fromCursor(args.after || args.before);
        let orderValue = cursor.orderValue;

        if (model.rawAttributes[orderAttribute].type instanceof model.sequelize.constructor.DATE) {
          orderValue = new Date(orderValue);
        }

        let slicingWhere = {
          $or: [
            {
              [orderAttribute]: {
                [orderDirection === 'ASC' ? '$gt' : '$lt']: orderValue
              }
            },
            {
              [orderAttribute]: {
                $eq: orderValue
              },
              [model.primaryKeyAttribute]: {
                $gt: cursor.id
              }
            }
          ]
        };

        // TODO, do a proper merge that won't kill another $or
        _.assign(options.where, slicingWhere);
      }

      // apply uniq to the attributes
      options.attributes = _.uniq(options.attributes);


      return before(options, args, root, context);
    },
    after: function (values, args, root, {source}) {
      let edges = values.map((value) => {
        return resolveEdge(value, args, source);
      });

      let firstEdge = edges[0];
      let lastEdge = edges[edges.length - 1];
      let fullCount = values[0] && values[0].dataValues.full_count && parseInt(values[0].dataValues.full_count, 10);

      if (!values[0]) {
        fullCount = 0;
      }
      if (model.sequelize.dialect.name === 'postgres' && (args.first || args.last)) {
        if (fullCount === null || fullCount === undefined) throw new Error('No fullcount available');
      }

      return {
        source,
        args,
        where: argsToWhere(args),
        edges,
        pageInfo: {
          startCursor: firstEdge ? firstEdge.cursor : null,
          endCursor: lastEdge ? lastEdge.cursor : null,
          hasPreviousPage: args.last !== null && args.last !== undefined ? fullCount > parseInt(args.last, 10) : false,
          hasNextPage: args.first !== null && args.first !== undefined ? fullCount > parseInt(args.first, 10) : false,
        }
      };
    }
  });

  let resolver = (source, args, info) => {
    if (simplifyAST(info.fieldASTs[0], info).fields.edges) {
      return $resolver(source, args, info);
    }

    return {
      source,
      args,
      where: argsToWhere(args)
    };
  };

  resolver.$association = $resolver.$association;
  resolver.$before = $resolver.$before;
  resolver.$after = $resolver.$after;
  resolver.$options = $resolver.$options;

  return {
    connectionType,
    edgeType,
    nodeType,
    resolveEdge,
    connectionArgs: $connectionArgs,
    resolve: resolver
  };
}
