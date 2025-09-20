const bcrypt = require('bcryptjs');
const salt = bcrypt.genSaltSync(12);
const hash = bcrypt.hashSync("a1", salt);
console.log(hash);