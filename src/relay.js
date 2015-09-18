import {fromGlobalId, connectionFromArray, nodeDefinitions} from 'graphql-relay';

export function idFetcher(sequelize) {
  return globalId => {
    const {type, id} = fromGlobalId(globalId);
    const models = sequelize.models.map(model => model.name);
    if (models.any(model => model === type)) {
      return sequelize.models[type].findById(id);
    }
    return null;
  };
}

export function typeResolver(types) {
  return obj => {
    return types[obj.__options.name.singular];
  }
}

export function isConnection(type) {
  return typeof type.name !== 'undefined' && type.name.endsWith('Connection');
}

export function handleConnection(values, args) {
  return connectionFromArray(values, args);
}

export function sequelizeNodeInterface(sequelize, types) {
  return nodeDefinitions(idFetcher(sequelize), typeResolver(types));
}
