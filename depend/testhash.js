const crypto = require('crypto');
const bcrypt = require('bcrypt');
const hash1 = crypto.createHash('sha256').update('frost').digest('hex');
console.log(hash1);
const hash2 = bcrypt.hashSync(hash1,10);
console.log(hash2);
console.log(bcrypt.compareSync(hash1,hash2))