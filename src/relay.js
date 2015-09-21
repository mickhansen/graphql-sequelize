import {fromGlobalId, connectionFromArray, nodeDefinitions} from 'graphql-relay';

class NodeTypeMapper {

  constructor( sequelize ) {
    this.models = Object.keys(sequelize.models);
    this.models.forEach(model => {
      this[model] = null;
    });
  }

  mapTypes( types ) {
    this.models.forEach(model => {
      if (types[model]) {
        this[model] = types[model];
      }
    });
  }
}

export function idFetcher(sequelize) {
  return globalId => {
    let {type, id} = fromGlobalId(globalId);
    const models = Object.keys(sequelize.models);
    type = type.toLowerCase();
    if (models.some(model => model === type)) {
      return sequelize.models[type].findById(id);
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
  const nodeObjects = nodeDefinitions(idFetcher(sequelize), obj => {
    return nodeTypeMapper[obj.Model.options.name.singular];
  });
  return {
    nodeTypeMapper,
    ...nodeObjects
  };
}
