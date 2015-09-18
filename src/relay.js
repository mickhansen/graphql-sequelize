import {fromGlobalId, nodeDefinitions} from 'graphql-relay';

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

export function sequelizeNodeInterface(sequelize, types) {
  return nodeDefintions(idFetcher(sequelize), typeResolver(types));
}
