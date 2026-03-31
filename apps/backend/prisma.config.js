"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const config_1 = require("prisma/config");
exports.default = (0, config_1.defineConfig)({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'npx ts-node --project tsconfig.json prisma/seed.ts',
    },
    datasource: {
        url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
        directUrl: process.env['DIRECT_URL'],
    },
});
//# sourceMappingURL=prisma.config.js.map