'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sequelizeConnection = exports.NodeTypeMapper = undefined;

var _bluebird = require('bluebird');

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.idFetcher = idFetcher;
exports.typeResolver = typeResolver;
exports.isConnection = isConnection;
exports.handleConnection = handleConnection;
exports.sequelizeNodeInterface = sequelizeNodeInterface;
exports.nodeType = nodeType;

var _graphqlRelay = require('graphql-relay');

var _graphql = require('graphql');

var _base = require('./base64.js');

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _simplifyAST = require('./simplifyAST');

var _simplifyAST2 = _interopRequireDefault(_simplifyAST);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class NodeTypeMapper {
  constructor() {
    this.map = {};
  }

  mapTypes(types) {
    Object.keys(types).forEach(k => {
      let v = types[k];
      this.map[k] = v.type ? v : { type: v };
    });
  }

  item(type) {
    return this.map[type];
  }
}

exports.NodeTypeMapper = NodeTypeMapper;
function idFetcher(sequelize, nodeTypeMapper) {
  return (() => {
    var _ref = (0, _bluebird.coroutine)(function* (globalId, context) {
      var _fromGlobalId = (0, _graphqlRelay.fromGlobalId)(globalId);

      const type = _fromGlobalId.type,
            id = _fromGlobalId.id;


      const nodeType = nodeTypeMapper.item(type);
      if (nodeType && typeof nodeType.resolve === 'function') {
        const res = yield Promise.resolve(nodeType.resolve(globalId, context));
        if (res) res.__graphqlType__ = type;
        return res;
      }

      const model = Object.keys(sequelize.models).find(function (model) {
        return model === type;
      });
      return model ? sequelize.models[model].findById(id) : nodeType ? nodeType.type : null;
    });

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  })();
}

function typeResolver(nodeTypeMapper) {
  return obj => {
    var type = obj.__graphqlType__ || (obj.Model ? obj.Model.options.name.singular : obj.name);

    if (!type) {
      throw new Error(`Unable to determine type of ${typeof obj}. ` + `Either specify a resolve function in 'NodeTypeMapper' object, or specify '__graphqlType__' property on object.`);
    }

    const nodeType = nodeTypeMapper.item(type);
    return nodeType && nodeType.type || null;
  };
}

function isConnection(type) {
  return typeof type.name !== 'undefined' && type.name.endsWith('Connection');
}

function handleConnection(values, args) {
  return (0, _graphqlRelay.connectionFromArray)(values, args);
}

function sequelizeNodeInterface(sequelize) {
  let nodeTypeMapper = new NodeTypeMapper();
  const nodeObjects = (0, _graphqlRelay.nodeDefinitions)(idFetcher(sequelize, nodeTypeMapper), typeResolver(nodeTypeMapper));

  return _extends({
    nodeTypeMapper: nodeTypeMapper
  }, nodeObjects);
}

function nodeType(connectionType) {
  return connectionType._fields.edges.type.ofType._fields.node.type;
}

function sequelizeConnection(_ref2) {
  let name = _ref2.name,
      nodeType = _ref2.nodeType,
      target = _ref2.target,
      orderByEnum = _ref2.orderBy,
      _before = _ref2.before,
      _after = _ref2.after,
      connectionFields = _ref2.connectionFields,
      edgeFields = _ref2.edgeFields,
      where = _ref2.where;

  var _connectionDefinition = (0, _graphqlRelay.connectionDefinitions)({
    name: name,
    nodeType: nodeType,
    connectionFields: connectionFields,
    edgeFields: edgeFields
  });

  const edgeType = _connectionDefinition.edgeType,
        connectionType = _connectionDefinition.connectionType;


  const model = target.target ? target.target : target;
  const SEPERATOR = '$';
  const PREFIX = 'arrayconnection' + SEPERATOR;

  if (orderByEnum === undefined) {
    orderByEnum = new _graphql.GraphQLEnumType({
      name: name + 'ConnectionOrder',
      values: {
        ID: { value: [model.primaryKeyAttribute, 'ASC'] }
      }
    });
  }

  _before = _before || (options => options);
  _after = _after || (result => result);

  let $connectionArgs = _extends({}, _graphqlRelay.connectionArgs, {
    orderBy: {
      type: new _graphql.GraphQLList(orderByEnum)
    }
  });

  let orderByAttribute = function orderByAttribute(orderAttr, _ref3) {
    let source = _ref3.source,
        args = _ref3.args,
        context = _ref3.context,
        info = _ref3.info;

    return typeof orderAttr === 'function' ? orderAttr(source, args, context, info) : orderAttr;
  };

  let orderByDirection = function orderByDirection(orderDirection, args) {
    if (args.last) {
      return orderDirection.indexOf('ASC') >= 0 ? orderDirection.replace('ASC', 'DESC') : orderDirection.replace('DESC', 'ASC');
    }
    return orderDirection;
  };

  /**
   * Creates a cursor given a item returned from the Database
   * @param  {Object}   item   sequelize model instance
   * @param  {Integer}  index  the index of this item within the results, 0 indexed
   * @return {String}          The Base64 encoded cursor string
   */
  let toCursor = function toCursor(item, index) {
    let id = item.get(model.primaryKeyAttribute);
    return (0, _base.base64)(PREFIX + id + SEPERATOR + index);
  };

  /**
   * Decode a cursor into its component parts
   * @param  {String} cursor Base64 encoded cursor
   * @return {Object}        Object containing ID and index
   */
  let fromCursor = function fromCursor(cursor) {
    cursor = (0, _base.unbase64)(cursor);
    cursor = cursor.substring(PREFIX.length, cursor.length);

    var _cursor$split = cursor.split(SEPERATOR),
        _cursor$split2 = _slicedToArray(_cursor$split, 2);

    let id = _cursor$split2[0],
        index = _cursor$split2[1];


    return {
      id: id,
      index: index
    };
  };

  let argsToWhere = function argsToWhere(args) {
    let result = {};

    _lodash2.default.each(args, (value, key) => {
      if (key in $connectionArgs) return;
      _lodash2.default.assign(result, where(key, value, result));
    });

    return result;
  };

  let resolveEdge = function resolveEdge(item, index, queriedCursor) {
    let args = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    let source = arguments[4];

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
      source: source
    };
  };

  let $resolver = require('./resolver')(target, {
    handleConnection: false,
    list: true,
    before: function before(options, args, context, info) {
      if (args.first || args.last) {
        options.limit = parseInt(args.first || args.last, 10);
      }
      if (!args.orderBy) {
        args.orderBy = [orderByEnum._values[0].value];
      } else if (typeof args.orderBy === 'string') {
        args.orderBy = [orderByEnum._nameLookup[args.orderBy].value];
      }

      let orderBy = args.orderBy;
      let orderAttribute = orderByAttribute(orderBy[0][0], {
        source: info.source,
        args: args,
        context: context,
        info: info
      });
      let orderDirection = orderByDirection(orderBy[0][1], args);

      options.order = [[orderAttribute, orderDirection]];

      if (orderAttribute !== model.primaryKeyAttribute) {
        options.order.push([model.primaryKeyAttribute, orderByDirection('ASC', args)]);
      }

      if (typeof orderAttribute === 'string') {
        options.attributes.push(orderAttribute);
      }

      if (options.limit && !options.attributes.some(attribute => attribute.length === 2 && attribute[1] === 'full_count')) {
        if (model.sequelize.dialect.name === 'postgres') {
          options.attributes.push([model.sequelize.literal('COUNT(*) OVER()'), 'full_count']);
        } else if (model.sequelize.dialect.name === 'mssql') {
          options.attributes.push([model.sequelize.literal('COUNT(1) OVER()'), 'full_count']);
        }
      }

      options.where = argsToWhere(args);

      if (args.after || args.before) {
        let cursor = fromCursor(args.after || args.before);
        let startIndex = Number(cursor.index);

        if (startIndex >= 0) options.offset = startIndex + 1;
      }
      options.attributes = _lodash2.default.uniq(options.attributes);
      return _before(options, args, context, info);
    },
    after: (() => {
      var _ref4 = (0, _bluebird.coroutine)(function* (values, args, context, info) {
        const source = info.source;


        var cursor = null;

        if (args.after || args.before) {
          cursor = fromCursor(args.after || args.before);
        }

        let edges = values.map(function (value, idx) {
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
          const options = yield Promise.resolve(_before({
            where: argsToWhere(args)
          }, args, context, info));

          if (target.count) {
            if (target.associationType) {
              fullCount = yield target.count(source, options);
            } else {
              fullCount = yield target.count(options);
            }
          } else {
            fullCount = yield target.manyFromSource.count(source, options);
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
            var _ref5 = [hasPreviousPage, hasNextPage];
            hasNextPage = _ref5[0];
            hasPreviousPage = _ref5[1];
          }
        }

        return _after({
          source: source,
          args: args,
          where: argsToWhere(args),
          edges: edges,
          pageInfo: {
            startCursor: firstEdge ? firstEdge.cursor : null,
            endCursor: lastEdge ? lastEdge.cursor : null,
            hasNextPage: hasNextPage,
            hasPreviousPage: hasPreviousPage
          }
        }, args, context, info);
      });

      function after(_x4, _x5, _x6, _x7) {
        return _ref4.apply(this, arguments);
      }

      return after;
    })()
  });

  let resolver = (source, args, context, info) => {
    var fieldNodes = info.fieldASTs || info.fieldNodes;
    if ((0, _simplifyAST2.default)(fieldNodes[0], info).fields.edges) {
      return $resolver(source, args, context, info);
    }

    return {
      source: source,
      args: args,
      where: argsToWhere(args)
    };
  };

  return {
    connectionType: connectionType,
    edgeType: edgeType,
    nodeType: nodeType,
    resolveEdge: resolveEdge,
    connectionArgs: $connectionArgs,
    resolve: resolver
  };
}
exports.sequelizeConnection = sequelizeConnection;