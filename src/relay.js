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
 * Creates a cursor given a node returned from the Database
 * @param  {Object}   node            sequelize model instance
 * @param  {String[]} orderAttributes  the attributes pertaining in ordering
 * @return {String}                   The Base64 encoded cursor string
 */
function toCursor(node, info) {
  return base64(JSON.stringify(info.orderAttributes.map(attr => node.get(attr))));
}

/**
 * Creates a cursor given a node returned from the Database
 * (in the case that an offset had to be used instead of a window)
 * @param  {Object}   node            sequelize model instance
 * @param  {String[]} orderAttributes  the attributes pertaining in ordering
 * @return {String}                   The Base64 encoded cursor string
 */
function toOffsetCursor(node, index) {
  const {primaryKeyAttribute} = getModelOfInstance(node);
  const id = typeof primaryKeyAttribute === 'string' ? node.get(primaryKeyAttribute) : null;
  return base64(JSON.stringify([id, index]));
}

/**
 * Decode a cursor into its component parts
 * @param  {String} cursor Base64 encoded cursor
 * @return {any[]}         array containing values of attributes pertaining to ordering
 */
function fromCursor(cursor) {
  return JSON.parse(unbase64(cursor));
}

const dialectsThatSupportTupleComparison = {
  mysql: true,
  postgres: true,
  sqlite: true,
};

function tupleComparison(model, attributes, inequality, values) {
  const {sequelize, QueryGenerator} = model;
  const attributesStr = attributes.map(attribute => QueryGenerator.quoteIdentifier(attribute)).join(', ');
  const escapeOptions = {context: 'SELECT'};
  const valuesStr = attributes.map((attribute, i) =>
    QueryGenerator.escape(values[i], model.attributes[attribute], escapeOptions)
  ).join(', ');
  return sequelize.literal(`(${attributesStr}) ${inequality} (${valuesStr})`);
}

function getWindow({model, cursor, order, inclusive}) {
  const values = fromCursor(cursor);
  order.forEach(([orderAttribute], index) => {
    if (model.rawAttributes[orderAttribute].type instanceof model.sequelize.constructor.DATE) {
      values[index] = new Date(values[index]);
    }
  });

  const {sequelize} = model;
  const allAscending = _.every(order, item => item[1].indexOf('ASC') >= 0);
  const allDescending = _.every(order, item => item[1].indexOf('DESC') >= 0);

  if ((allAscending || allDescending) && dialectsThatSupportTupleComparison[sequelize.getDialect()]) {
    let inequality = allAscending ? '>' : '<';
    if (inclusive) inequality += '=';
    const attributes = order.map(([attribute]) => attribute);
    return tupleComparison(model, attributes, inequality, values);
  }

  // given ORDER BY A ASC, B DESC, C ASC, the following code would create this logic:
  // A > cursorValues[A] OR
  // (A = cursorValues[A] AND (
  //   B < cursorValues[B] OR (
  //     B = cursorValues[B] AND C > cursorValues[C]
  //   )
  // )

  function buildInequality(index) {
    const [attr, direction] = order[index];
    const value = values[index];
    let inequality = direction.indexOf('ASC') >= 0 ? '$gt' : '$lt';
    if (index === order.length - 1) {
      if (inclusive) inequality += 'e';
      return {[attr]: {[inequality]: value}};
    }
    return {$or: [
      {[attr]: {[inequality]: value}},
      {[attr]: value, ...buildInequality(index + 1)},
    ]};
  }

  return buildInequality(0);
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

  const argsToWhere = function (args) {
    let result = {};

    if (where === undefined) return result;

    _.each(args, (value, key) => {
      if (ignoreArgs && key in ignoreArgs) return;
      _.assign(result, where(key, value, result));
    });

    return result;
  };

  const resolveEdge = function (node, index, queriedCursor, sourceArgs = {}, info, source) {
    if (info.mustUseOffset) {
      let startIndex = null;
      if (queriedCursor) startIndex = Number(queriedCursor[1]);
      if (startIndex !== null) {
        startIndex++;
      } else {
        startIndex = 0;
      }

      return {
        cursor: toOffsetCursor(node, index + startIndex),
        node,
        source,
      };
    }

    return {
      cursor: toCursor(node, info),
      node,
      source,
      sourceArgs,
    };
  };

  const $resolver = require('./resolver')(targetMaybeThunk, {
    handleConnection: false,
    list: true,
    before: function (options, args, context, info) {
      return before({
        ...options,
        ...info.options,
        attributes: _.uniq([...info.orderAttributes, ...options.attributes]),
      }, args, context, info);
    },
    after,
  });

  const resolver = async (source, args, context, info) => {
    const {first, last} = args;
    if (first < 0) throw new Error('first must be >= 0 if given');
    if (last < 0) throw new Error('last must be >= 0 if given');

    const fieldNodes = info.fieldASTs || info.fieldNodes;
    const ast = simplifyAST(fieldNodes[0], info);
    if (!ast.fields.edges) {
      return after({
        source,
        args,
        where: argsToWhere(args)
      }, args, context, info);
    }

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
        , orderAttributes = order.map(([attribute]) => attribute).filter(attribute => typeof attribute === 'string');

    let limit;
    if (first || last) limit = Math.min(first || Infinity, last || Infinity) + 1;

    let offset;
    const mustUseOffset = _.some(order, ([attribute]) => typeof attribute !== 'string');
    if (mustUseOffset) {
      offset = 0;
      if (args.after || args.before) {
        const cursor = fromCursor(args.after || args.before);
        const startIndex = Number(cursor[1]);
        if (startIndex >= 0) offset = startIndex + 1;
      }
    } else {
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
    }

    const finalOrder = last ? reverseOrder(order) : order;

    const extendedInfo = {
      ...info,
      order,
      orderAttributes,
      mustUseOffset,
      options: {
        where,
        order: finalOrder,
        limit,
        offset, // may be null
      },
    };
    const nodesPromise = $resolver(source, args, context, extendedInfo);

    let hasNextPage = false;
    let hasPreviousPage = false;

    async function hasAnotherPage(cursor, order) {
      if (mustUseOffset) return offset > 0;

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
        orderAttributes,
        options: {
          where,
          order,
          limit: 1,
        },
      });
      return otherNodes.length > 0;
    }

    const hasNextPageRequested = _.has(ast, ['fields', 'pageInfo', 'fields', 'hasNextPage']);
    const hasPreviousPageRequested = _.has(ast, ['fields', 'pageInfo', 'fields', 'hasPreviousPage']);

    if (first) hasNextPage = (await nodesPromise).length > first;
    else if (args.before && hasNextPageRequested) {
      hasNextPage = await hasAnotherPage(args.before, order);
    }

    if (last) hasPreviousPage = (await nodesPromise).length > last;
    else if (args.after && hasPreviousPageRequested) {
      hasPreviousPage = await hasAnotherPage(args.after, reverseOrder(order));
    }

    let queriedCursor = null;

    if (args.after || args.before) {
      queriedCursor = fromCursor(args.after || args.before);
    }

    const nodes = await nodesPromise;
    const edges = nodes.slice(0, Math.min(first || Infinity, last || Infinity)).map(
      (node, index) => resolveEdge(node, index, queriedCursor, args, extendedInfo, source)
    );
    if (last) edges.reverse();

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
    }, args, context, extendedInfo);
  };

  return {
    resolveEdge,
    resolveConnection: resolver,
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
