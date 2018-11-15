import {
  fromGlobalId,
  connectionFromArray,
  nodeDefinitions,
  connectionDefinitions,
  connectionArgs
} from 'graphql-relay';

import {
  GraphQLList
} from 'graphql';

import {
  base64,
  unbase64,
} from './base64.js';

import _ from 'lodash';
import simplifyAST from './simplifyAST';

import {Model} from 'sequelize';

function getModelOfInstance(instance) {
  return instance instanceof Model ? instance.constructor : instance.Model;
}

export class NodeTypeMapper {
  constructor() {
    this.map = { };
  }

  mapTypes(types) {
    Object.keys(types).forEach((k) => {
      let v = types[k];
      this.map[k] = v.type
        ? v
        : { type: v };
    });
  }

  item(type) {
    return this.map[type];
  }
}

export function idFetcher(sequelize, nodeTypeMapper) {
  return async (globalId, context, info) => {
    const {type, id} = fromGlobalId(globalId);

    const nodeType = nodeTypeMapper.item(type);
    if (nodeType && typeof nodeType.resolve === 'function') {
      const res = await Promise.resolve(nodeType.resolve(globalId, context, info));
      if (res) res.__graphqlType__ = type;
      return res;
    }

    const model = Object.keys(sequelize.models).find(model => model === type);
    if (model) {
      return sequelize.models[model].findById(id);
    }

    if (nodeType) {
      return typeof nodeType.type === 'string' ? info.schema.getType(nodeType.type) : nodeType.type;
    }

    return null;
  };
}

export function typeResolver(nodeTypeMapper) {
  return (obj, context, info) => {
    var type = obj.__graphqlType__
               || (obj.Model
                 ? obj.Model.options.name.singular
                 : obj._modelOptions
                 ? obj._modelOptions.name.singular
                 : obj.name);

    if (!type) {
      throw new Error(`Unable to determine type of ${ typeof obj }. ` +
        `Either specify a resolve function in 'NodeTypeMapper' object, or specify '__graphqlType__' property on object.`);
    }

    const nodeType = nodeTypeMapper.item(type);
    if (nodeType) {
      return typeof nodeType.type === 'string' ? info.schema.getType(nodeType.type) : nodeType.type;
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

export function createNodeInterface(sequelize) {
  let nodeTypeMapper = new NodeTypeMapper();
  const nodeObjects = nodeDefinitions(
    idFetcher(sequelize, nodeTypeMapper),
    typeResolver(nodeTypeMapper)
  );

  return {
    nodeTypeMapper,
    ...nodeObjects
  };
}

export {createNodeInterface as sequelizeNodeInterface};

export function nodeType(connectionType) {
  return connectionType._fields.edges.type.ofType._fields.node.type;
}

export function createConnectionResolver({
  target: targetMaybeThunk,
  before,
  after,
  where,
  orderBy: orderByEnum,
  ignoreArgs
}) {
  before = before || ((options) => options);
  after = after || ((result) => result);

  let orderByAttribute = function (orderAttr, {source, args, context, info}) {
    return typeof orderAttr === 'function' ? orderAttr(source, args, context, info) : orderAttr;
  };

  let orderByDirection = function (orderDirection, args) {
    if (args.last) {
      return orderDirection.indexOf('ASC') >= 0
              ? orderDirection.replace('ASC', 'DESC')
              : orderDirection.replace('DESC', 'ASC');
    }
    return orderDirection;
  };

  /**
   * Creates a cursor given a item returned from the Database
   * @param  {Object}   item   sequelize model instance
   * @param  {Integer}  index  the index of this item within the results, 0 indexed
   * @return {String}          The Base64 encoded cursor string
   */
  let toCursor = function (item, index) {
    const {primaryKeyAttribute} = getModelOfInstance(item);
    const id = typeof primaryKeyAttribute === 'string' ? item.get(primaryKeyAttribute) : null;
    return base64(JSON.stringify([id, index]));
  };

  /**
   * Decode a cursor into its component parts
   * @param  {String} cursor Base64 encoded cursor
   * @return {Object}        Object containing ID and index
   */
  let fromCursor = function (cursor) {
    let [id, index] = JSON.parse(unbase64(cursor));

    return {
      id,
      index
    };
  };

  let argsToWhere = function (args) {
    let result = {};

    if (where === undefined) return result;

    _.each(args, (value, key) => {
      if (ignoreArgs && key in ignoreArgs) return;
      Object.assign(result, where(key, value, result));
    });

    return result;
  };

  let resolveEdge = function (item, index, queriedCursor, sourceArgs = {}, source) {
    let startIndex = null;
    if (queriedCursor) startIndex = Number(queriedCursor.index);
    if (startIndex !== null) {
      startIndex++;
    } else {
      startIndex = 0;
    }

    return {
      cursor: toCursor(item, index + startIndex),
      node: item,
      source: source,
      sourceArgs
    };
  };

  let $resolver = require('./resolver')(targetMaybeThunk, {
    handleConnection: false,
    list: true,
    before: function (options, args, context, info) {
      const target = info.target;
      const model = target.target ? target.target : target;

      if (args.first || args.last) {
        options.limit = parseInt(args.first || args.last, 10);
      }

      // Grab enum type by name if it's a string
      orderByEnum = typeof orderByEnum === 'string' ? info.schema.getType(orderByEnum) : orderByEnum;

      let orderBy = args.orderBy ? args.orderBy :
                    orderByEnum ? [orderByEnum._values[0].value] :
                    [[model.primaryKeyAttribute, 'ASC']];

      if (orderByEnum && typeof orderBy === 'string') {
        orderBy = [orderByEnum._nameLookup[args.orderBy].value];
      }

      let orderAttribute = orderByAttribute(orderBy[0][0], {
        source: info.source,
        args,
        context,
        info
      });
      let orderDirection = orderByDirection(orderBy[0][1], args);

      options.order = [
        [orderAttribute, orderDirection]
      ];

      if (orderAttribute !== model.primaryKeyAttribute) {
        options.order.push([model.primaryKeyAttribute, orderByDirection('ASC', args)]);
      }

      if (typeof orderAttribute === 'string') {
        options.attributes.push(orderAttribute);
      }

      if (options.limit && !options.attributes.some(attribute => attribute.length === 2 && attribute[1] === 'full_count')) {
        if (model.sequelize.dialect.name === 'postgres') {
          options.attributes.push([
            model.sequelize.literal('COUNT(*) OVER()'),
            'full_count'
          ]);
        } else if (model.sequelize.dialect.name === 'mssql') {
          options.attributes.push([
            model.sequelize.literal('COUNT(1) OVER()'),
            'full_count'
          ]);
        }
      }

      options.where = argsToWhere(args);

      if (args.after || args.before) {
        let cursor = fromCursor(args.after || args.before);
        let startIndex = Number(cursor.index);

        if (startIndex >= 0) options.offset = startIndex + 1;
      }
      options.attributes = _.uniq(options.attributes);
      return before(options, args, context, info);
    },
    after: async function (values, args, context, info) {
      const {
        source,
        target
      } = info;

      var cursor = null;

      if (args.after || args.before) {
        cursor = fromCursor(args.after || args.before);
      }

      let edges = values.map((value, idx) => {
        return resolveEdge(value, idx, cursor, args, source);
      });

      let firstEdge = edges[0];
      let lastEdge = edges[edges.length - 1];
      let fullCount = values[0] && values[0].dataValues.full_count && parseInt(values[0].dataValues.full_count, 10);

      if (!values[0]) {
        fullCount = 0;
      }

      if ((args.first || args.last) && (fullCount === null || fullCount === undefined)) {
        // In case of `OVER()` is not available, we need to get the full count from a second query.
        const options = await Promise.resolve(before({
          where: argsToWhere(args)
        }, args, context, info));

        if (target.count) {
          if (target.associationType) {
            fullCount = await target.count(source, options);
          } else {
            fullCount = await target.count(options);
          }
        } else {
          fullCount = await target.manyFromSource.count(source, options);
        }
      }

      let hasNextPage = false;
      let hasPreviousPage = false;
      if (args.first || args.last) {
        const count = parseInt(args.first || args.last, 10);
        let index = cursor ? Number(cursor.index) : null;
        if (index !== null) {
          index++;
        } else {
          index = 0;
        }

        hasNextPage = index + 1 + count <= fullCount;
        hasPreviousPage = index - count >= 0;

        if (args.last) {
          [hasNextPage, hasPreviousPage] = [hasPreviousPage, hasNextPage];
        }
      }

      return after({
        source,
        args,
        where: argsToWhere(args),
        edges,
        pageInfo: {
          startCursor: firstEdge ? firstEdge.cursor : null,
          endCursor: lastEdge ? lastEdge.cursor : null,
          hasNextPage: hasNextPage,
          hasPreviousPage: hasPreviousPage
        },
        fullCount
      }, args, context, info);
    }
  });

  let resolveConnection = (source, args, context, info) => {
    var fieldNodes = info.fieldASTs || info.fieldNodes;
    if (simplifyAST(fieldNodes[0], info).fields.edges) {
      return $resolver(source, args, context, info);
    }

    return after({
      source,
      args,
      where: argsToWhere(args)
    }, args, context, info);
  };

  return {
    resolveEdge,
    resolveConnection
  };
}

export function createConnection({
  name,
  nodeType,
  target: targetMaybeThunk,
  orderBy: orderByEnum,
  before,
  after,
  connectionFields,
  edgeFields,
  where
}) {
  const {
    edgeType,
    connectionType
  } = connectionDefinitions({
    name,
    nodeType,
    connectionFields,
    edgeFields
  });

  let $connectionArgs = {
    ...connectionArgs
  };

  if (orderByEnum) {
    $connectionArgs.orderBy = {
      type: new GraphQLList(orderByEnum)
    };
  }

  const {
    resolveEdge,
    resolveConnection
  } = createConnectionResolver({
    orderBy: orderByEnum,
    target: targetMaybeThunk,
    before,
    after,
    where,
    ignoreArgs: $connectionArgs
  });

  return {
    connectionType,
    edgeType,
    nodeType,
    resolveEdge,
    resolveConnection,
    connectionArgs: $connectionArgs,
    resolve: resolveConnection
  };
}

export {createConnection as sequelizeConnection};
