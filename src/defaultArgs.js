import * as typeMapper from './typeMapper';
import JSONType from './types/jsonType';

module.exports = function (Model) {
  var result = {}
    , key = Model.primaryKeyAttribute
    , attribute = Model.rawAttributes[key]
    , type;

  if (key && attribute) {
    type = typeMapper.toGraphQL(attribute.type, Model.sequelize.constructor);
    result[key] = {
      type: type
    };
  }

  // add where
  result.where = {
    type: JSONType,
    description: 'A JSON object conforming the the shape specified in http://docs.sequelizejs.com/en/latest/docs/querying/'
  };

  return result;
};
