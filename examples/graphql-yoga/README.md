# `graphql-sequelize` + `graphql-yoga`

An example of how to set up `graphql-sequelize` and `dataloader-sequelize` with `graphql-yoga`.

## Prerequisites

- Node 8+

```bash
npm install
npm start
open http://localhost:4000
```

## Running a query

In GraphQL Playground, run the following query:

```graphql
{
  pets {
    name

    owner {
      id
      name
    }
  }
}
```

Your response should look like this:

```json
{
  "data": {
    "pets": [
      {
        "name": "Bat",
        "owner": {
          "id": "1",
          "name": "Foo"
        }
      },
      {
        "name": "Baz",
        "owner": {
          "id": "2",
          "name": "Bar"
        }
      }
    ]
  }
}
```

To verify that DataLoader is working as expected, look at your server output. You should see two
queries:

```bash
Executing (default): SELECT `id`, `name`, `ownerId`, `createdAt`, `updatedAt` FROM `pets` AS `Pet` ORDER BY `Pet`.`id` ASC;
Executing (default): SELECT `id`, `name`, `createdAt`, `updatedAt` FROM `users` AS `User` WHERE `User`.`id` IN (1, 2);
```

For comparison, open [src/server.js](./src/server.js) and comment out the entirety of the
`context` option that gets passed into `GraphQLServer`. Restart the server, run the
GraphQL query again, and check the server output. Now, you should see three queries:

```bash
Executing (default): SELECT `id`, `name`, `ownerId`, `createdAt`, `updatedAt` FROM `pets` AS `Pet` ORDER BY `Pet`.`id` ASC;
Executing (default): SELECT `id`, `name`, `createdAt`, `updatedAt` FROM `users` AS `User` WHERE `User`.`id` = 1;
Executing (default): SELECT `id`, `name`, `createdAt`, `updatedAt` FROM `users` AS `User` WHERE `User`.`id` = 2;
```
