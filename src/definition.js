import {GraphQLScalarType} from 'graphql';
import {Kind} from 'graphql/language';

export const GraphQLJSON = new GraphQLScalarType({
  name: 'JSON',
  description: 'The `JSON` scalar type represents `JSON` object.',
  serialize(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;

    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    return ast.kind === Kind.OBJECT ? ast.value : null;
  }
});
