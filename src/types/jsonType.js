import {
  GraphQLScalarType,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLString
} from 'graphql';
import _ from 'lodash';

import { Kind } from 'graphql/language';


const astToJson = {
  [Kind.INT](ast) {
    return GraphQLInt.parseLiteral(ast);
  },
  [Kind.FLOAT](ast) {
    return GraphQLFloat.parseLiteral(ast);
  },
  [Kind.BOOLEAN](ast) {
    return GraphQLBoolean.parseLiteral(ast);
  },
  [Kind.STRING](ast) {
    return GraphQLString.parseLiteral(ast);
  },
  [Kind.ENUM](ast) {
    return String(ast.value);
  },
  [Kind.LIST](ast) {
    return ast.values.map(astItem => {
      return JSONType.parseLiteral(astItem);
    });
  },
  [Kind.OBJECT](ast) {
    let obj = {};
    ast.fields.forEach(field => {
      obj[field.name.value] = JSONType.parseLiteral(field.value);
    });
    return obj;
  },
  [Kind.VARIABLE](ast) {
    /*
    this way converted query variables would be easily
    converted to actual values in the resolver.js by just
    passing the query variables object in to function below.
    We can`t convert them just in here because query variables
    are not accessible from GraphQLScalarType's parseLiteral method
    */
    return _.property(ast.name.value);
  }
};


const JSONType = new GraphQLScalarType({
  name: 'SequelizeJSON',
  description: 'The `JSON` scalar type represents raw JSON as values.',
  serialize: value => value,
  parseValue: value => typeof value === 'string' ? JSON.parse(value) : value,
  parseLiteral: ast => {
    const parser = astToJson[ast.kind];
    return parser ? parser.call(this, ast) : null;
  }
});


export default JSONType;
