const bcrypt = require('bcryptjs');

// Script to generate bcrypt hash for passwords
// Usage: node scripts/hashPassword.js <password>

const password = process.argv[2];

if (!password) {
  console.error('Usage: node hashPassword.js <password>');
  process.exit(1);
}

const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }
  
  console.log('Password:', password);
  console.log('Hashed:', hash);
  console.log('\nUse this hash in your database or .sql file');
});
