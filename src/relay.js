import {fromGlobalId, connectionFromArray, nodeDefinitions} from 'graphql-relay';

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
