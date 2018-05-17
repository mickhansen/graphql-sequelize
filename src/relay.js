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
  return async (globalId, context) => {
    const {type, id} = fromGlobalId(globalId);

    const nodeType = nodeTypeMapper.item(type);
    if (nodeType && typeof nodeType.resolve === 'function') {
      const res = await Promise.resolve(nodeType.resolve(globalId, context));
      if (res) res.__graphqlType__ = type;
      return res;
    }

    const model = Object.keys(sequelize.models).find(model => model === type);
    return model
      ? sequelize.models[model].findById(id)
      : nodeType
        ? nodeType.type
        : null;
  };
}

export function typeResolver(nodeTypeMapper) {
  return obj => {
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
    return nodeType && nodeType.type || null;
  };
}

export function isConnection(type) {
  return typeof type.name !== 'undefined' && type.name.endsWith('Connection');
}

export function handleConnection(values, args) {
  return connectionFromArray(values, args);
}

export function sequelizeNodeInterface(sequelize) {
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

export function nodeType(connectionType) {
  return connectionType._fields.edges.type.ofType._fields.node.type;
}

export function sequelizeConnection({
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

  before = before || ((options) => options);
  after = after || ((result) => result);

  let $connectionArgs = {
    ...connectionArgs
  };

  if (orderByEnum) {
    $connectionArgs.orderBy = {
      type: new GraphQLList(orderByEnum)
    };
  }

  let orderByDirection = function (orderDirection, args) {
    if (args.last) {
      return orderDirection.indexOf('ASC') >= 0
              ? orderDirection.replace('ASC', 'DESC')
              : orderDirection.replace('DESC', 'ASC');
    }
    return orderDirection;
  };

  let orderByAttribute = function (orderAttr, {source, args, context, info}) {
    return typeof orderAttr === 'function' ? orderAttr(source, args, context, info) : orderAttr;
  };

  function getOrder(orderBy, options) {
    const {args, info} = options;
    const target = info.target;
    const model = target.target ? target.target : target;
    const result = orderBy.map(([orderAttr, orderDirection]) => [
      orderByAttribute(orderAttr, options),
      orderByDirection(orderDirection, args),
    ]);
    model.primaryKeyAttributes.forEach(primaryKeyAttribute => {
      if (result.findIndex(([attr]) => attr === primaryKeyAttribute) < 0) {
        result.push([primaryKeyAttribute, orderByDirection('ASC', args)]);
      }
    });
    return result;
  }

  /**
   * Creates a cursor given a item returned from the Database
   * @param  {Object}   item            sequelize model instance
   * @param  {String[]} orerAttributes  the attributes pertaining in ordering
   * @return {String}                   The Base64 encoded cursor string
   */
  let toCursor = function (item, orderAttributes) {
    return base64(JSON.stringify(orderAttributes.map(attr => item.get(attr))));
  };

  /**
   * Decode a cursor into its component parts
   * @param  {String} cursor Base64 encoded cursor
   * @return {any[]}         array containing values of attributes pertaining to ordering
   */
  let fromCursor = function (cursor) {
    return JSON.parse(unbase64(cursor));
  };

  let argsToWhere = function (args) {
    let result = {};

    if (where === undefined) return result;

    _.each(args, (value, key) => {
      if (key in $connectionArgs) return;
      _.assign(result, where(key, value, result));
    });

    return result;
  };

  let resolveEdge = function (item, index, queriedCursor, args = {}, source, info) {
    return {
      cursor: toCursor(item, info.orderAttributes),
      node: item,
      source: source
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
        // include edges at before/after cursors, if given, to determine if there's a prev/next page
        if (args.before) options.limit++;
        if (args.after) options.limit++;
      }

      options.order = info.order;
      options.attributes.push(...info.orderAttributes);

      options.where = argsToWhere(args);

      if (args.after || args.before) {
        const cursor = fromCursor(args.after || args.before);
        if (cursor.length !== info.order.length) {
          throw new Error('cursor appears to be for a different ordering');
        }
        const slicingWhere = {};
        info.order.forEach(([orderAttribute, orderDirection], index) => {
          let orderValue = cursor[index];

          if (model.rawAttributes[orderAttribute].type instanceof model.sequelize.constructor.DATE) {
            orderValue = new Date(orderValue);
          }

          slicingWhere[orderAttribute] = {
            [orderDirection === 'ASC' ? '$gte' : '$lte']: orderValue
          };
        });
        if (options.where.$and) options.where.$and.push(slicingWhere);
        else options.where = {$and: [options.where, slicingWhere]};
      }
      options.attributes = _.uniq(options.attributes);
      return before(options, args, context, info);
    },
    after: async function (values, args, context, info) {
      const {
        source,
      } = info;

      var cursor = null;

      if (args.after || args.before) {
        cursor = fromCursor(args.after || args.before);
      }

      let edges = values.map((value, idx) => {
        return resolveEdge(value, idx, cursor, args, source, info);
      });

      let hasNextPage = false;
      let hasPreviousPage = false;
      if (args.first || args.last) {
        if (args.first) {
          const count = parseInt(args.first, 10);
          hasPreviousPage = edges.length && edges[0].cursor === args.after;
          if (hasPreviousPage) edges.shift();
          else edges.pop();
          hasNextPage = edges.length > count;
          if (hasNextPage) edges.pop();
        } else if (args.last) {
          const count = parseInt(args.last, 10);
          hasNextPage = edges.length && edges[0].cursor === args.before;
          if (hasNextPage) edges.shift();
          else edges.pop();
          hasPreviousPage = edges.length > count;
          if (hasPreviousPage) edges.pop();
        }
      }

      let firstEdge = edges[0];
      let lastEdge = edges[edges.length - 1];

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
      }, args, context, info);
    }
  });

  let resolver = async (source, args, context, info) => {
    const target = typeof targetMaybeThunk === 'function' && targetMaybeThunk.findAndCountAll === undefined ?
                   await Promise.resolve(targetMaybeThunk(source, args, context, info)) : targetMaybeThunk
        , model = target.target ? target.target : target;

    let orderBy = args.orderBy ? args.orderBy :
                  orderByEnum ? [orderByEnum._values[0].value] :
                  [[model.primaryKeyAttribute, 'ASC']];

    if (orderByEnum && typeof orderBy === 'string') {
      orderBy = [orderByEnum._nameLookup[args.orderBy].value];
    }

    const order = getOrder(orderBy, {source, args, context, info})
        , orderAttributes = order.map(([attribute]) => attribute);

    info = {
      ...info,
      order,
      orderAttributes,
    };

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
    connectionType,
    edgeType,
    nodeType,
    resolveEdge,
    connectionArgs: $connectionArgs,
    resolve: resolver
  };
}
