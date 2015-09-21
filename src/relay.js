import {fromGlobalId, connectionFromArray, nodeDefinitions} from 'graphql-relay';

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

export function typeResolver(types) {
  return obj => {
    console.log(types);
    return types[obj.Model.options.name.singular];
  };
}

export function isConnection(type) {
  return typeof type.name !== 'undefined' && type.name.endsWith('Connection');
}

export function handleConnection(values, args) {
  return connectionFromArray(values, args);
}

export function sequelizeNodeInterface(sequelize, fn) {
  return nodeDefinitions(idFetcher(sequelize), fn);
}
