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

function orderByAttribute(orderAttr, {source, args, context, info}) {
  return typeof orderAttr === 'function' ? orderAttr(source, args, context, info) : orderAttr;
}

function getOrder(orderBy, options) {
  const {model} = options;
  const result = orderBy.map(([orderAttr, orderDirection]) => [
    orderByAttribute(orderAttr, options),
    orderDirection,
  ]);
  model.primaryKeyAttributes.forEach(primaryKeyAttribute => {
    if (result.findIndex(([attr]) => attr === primaryKeyAttribute) < 0) {
      result.push([primaryKeyAttribute, 'ASC']);
    }
  });
  return result;
}

function reverseDirection(direction) {
  return direction.indexOf('ASC') >= 0
    ? direction.replace('ASC', 'DESC')
    : direction.replace('DESC', 'ASC');
}

function reverseOrder(order) {
  return order.map(([orderAttr, orderDirection]) => [orderAttr, reverseDirection(orderDirection)]);
}


/**
 * Creates a cursor given a item returned from the Database
 * @param  {Object}   item            sequelize model instance
 * @param  {String[]} orerAttributes  the attributes pertaining in ordering
 * @return {String}                   The Base64 encoded cursor string
 */
function toCursor(item, orderAttributes) {
  return base64(JSON.stringify(orderAttributes.map(attr => item.get(attr))));
}

/**
 * Decode a cursor into its component parts
 * @param  {String} cursor Base64 encoded cursor
 * @return {any[]}         array containing values of attributes pertaining to ordering
 */
function fromCursor(cursor) {
  return JSON.parse(unbase64(cursor));
}

function getWindow({model, cursor, order, inclusive}) {
  const values = fromCursor(cursor);
  order.forEach(([orderAttribute], index) => {
    if (model.rawAttributes[orderAttribute].type instanceof model.sequelize.constructor.DATE) {
      values[index] = new Date(values[index]);
    }
  });
  const $or = [];
  const window = {$or};

  if (inclusive) {
    // include any rows with all values equal to the cursor
    const isEqualToCursor = {};
    values.forEach((value, i) => {
      const [attr] = order[i];
      isEqualToCursor[attr] = value;
    });
    $or.push(isEqualToCursor);
  }

  // include any rows that are beyond the cursor

  // given ORDER BY A ASC, B DESC, C ASC, the following code would create this logic:
  // (A > cursorValues[A]) OR
  // (A = cursorValues[A] AND B < cursorValues[B]) OR
  // (A = cursorValues[A] AND B = cursorValues[B] AND C > cursorValues[C])

  for (let inequalAttrIndex = 0; inequalAttrIndex < order.length; inequalAttrIndex++) {
    const isBeyondCursor = {};
    for (let equalAttrIndex = 0; equalAttrIndex < inequalAttrIndex; equalAttrIndex++) {
      const [attr] = order[equalAttrIndex];
      const value = values[equalAttrIndex];
      isBeyondCursor[attr] = value;
    }

    const [attr, direction] = order[inequalAttrIndex];
    const value = values[inequalAttrIndex];
    if (direction.indexOf('ASC') >= 0) {
      isBeyondCursor[attr] = {$gt: value};
    } else {
      isBeyondCursor[attr] = {$lt: value};
    }
    $or.push(isBeyondCursor);
  }

  return window;
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

  let argsToWhere = function (args) {
    let result = {};

    if (where === undefined) return result;

    _.each(args, (value, key) => {
      if (key in $connectionArgs) return;
      _.assign(result, where(key, value, result));
    });

    return result;
  };

  let resolveEdge = function (item, info, source) {
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
      return before({
        ...options,
        ...info.options,
        attributes: _.uniq([...info.options.attributes, ...options.attributes]),
      }, args, context, info);
    },
    after,
  });

  let resolver = async (source, args, context, info) => {
    const {first, last} = args;
    if (first < 0) throw new Error('first must be >= 0 if given');
    if (last < 0) throw new Error('last must be >= 0 if given');

    const target = typeof targetMaybeThunk === 'function' && targetMaybeThunk.findAndCountAll === undefined ?
                   await Promise.resolve(targetMaybeThunk(source, args, context, info)) : targetMaybeThunk
        , model = target.target ? target.target : target;

    const where = argsToWhere(args);
    const $and = where.$and || (where.$and = []);

    let orderBy = args.orderBy ? args.orderBy :
                  orderByEnum ? [orderByEnum._values[0].value] :
                  [[model.primaryKeyAttribute, 'ASC']];

    if (orderByEnum && typeof orderBy === 'string') {
      orderBy = [orderByEnum._nameLookup[args.orderBy].value];
    }

    const order = getOrder(orderBy, {source, args, context, info, model})
        , attributes = order.map(([attribute]) => attribute);

    // const fieldNodes = info.fieldASTs || info.fieldNodes;
    // if (simplifyAST(fieldNodes[0], info).fields.edges) {
      // search in main direction
      // get query window from before/after
      // limit = min(first, last) + 1
    let limit;
    if (first || last) limit = Math.min(first || Infinity, last || Infinity) + 1;

    if (args.before) $and.push(getWindow({
      model,
      cursor: args.before,
      order: reverseOrder(order),
    }));
    if (args.after) $and.push(getWindow({
      model,
      cursor: args.after,
      order,
    }));

    const finalOrder = last ? reverseOrder(order) : order;

    const extendedInfo = {
      ...info,
      order,
      orderAttributes: attributes,
      options: {
        attributes,
        where,
        order: finalOrder,
        limit,
      },
    };
    const nodes = await $resolver(source, args, context, extendedInfo);

    let hasNextPage = false;
    let hasPreviousPage = false;

    const fieldNodes = info.fieldASTs || info.fieldNodes;
    const ast = simplifyAST(fieldNodes[0], info);

    async function hasAnotherPage(cursor, order) {
      const where = argsToWhere(args);
      const $and = where.$and || (where.$and = []);
      $and.push(getWindow({
        model,
        cursor,
        order,
        inclusive: true,
      }));
      const otherNodes = await $resolver(source, args, context, {
        ...info,
        order,
        orderAttributes: attributes,
        options: {
          attributes,
          where,
          order,
          limit: 1,
        },
      });
      return otherNodes.length > 0;
    }

    if (first) hasNextPage = nodes.length > first;
    else if (args.before && _.has(ast, ['fields', 'pageInfo', 'fields', 'hasNextPage'])) {
      hasNextPage = await hasAnotherPage(args.before, order);
    }

    if (last) hasPreviousPage = nodes.length > last;
    else if (args.after && _.has(ast, ['fields', 'pageInfo', 'fields', 'hasPreviousPage'])) {
      hasPreviousPage = await hasAnotherPage(args.after, reverseOrder(order));
    }

    const edges = nodes.slice(0, Math.min(first || Infinity, last || Infinity)).map(
      node => resolveEdge(node, extendedInfo, source)
    );

    const firstEdge = edges[0];
    const lastEdge = edges[edges.length - 1];

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
