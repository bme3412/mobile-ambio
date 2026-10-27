const { readFileSync } = require("node:fs");
const { assertEditionBundle } = require("../preview/lib/edition-contract.cjs");
assertEditionBundle(JSON.parse(readFileSync(process.argv[2], "utf8")));
console.log("Edition bundle passed validation.");
