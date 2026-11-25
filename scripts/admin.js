import { createInterface } from 'node:readline/promises';
import { stdin,stdout } from 'node:process';
import { Writable } from 'node:stream';
import { id,passwordHash } from '../src/domain.js';
import { run,db } from '../src/db.js';
import { now } from '../src/config.js';
const args=process.argv.slice(2),value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const username=value('--username','owner'),role=value('--role','admin');
if(!['admin','production'].includes(role))throw new Error('Role must be admin or production.');
let password=process.env[value('--password-env','ADMIN_PASSWORD')];
if(!password){
  const silentOutput=new Writable({write(_chunk,_encoding,done){done();}});
  const rl=createInterface({input:stdin,output:silentOutput,terminal:Boolean(stdin.isTTY)});
  stdout.write('Choose a password of at least 12 characters (input is hidden): ');
  try {password=await rl.question('');}
  finally {rl.close();stdout.write('\n');}
}
try{run('INSERT INTO users(id,username,role,password_hash,created_at) VALUES(?,?,?,?,?)',id(),username,role,passwordHash(password),now());console.log(`Created ${role} account: ${username}`);}catch(e){console.error(e.message.includes('UNIQUE')?'This username already exists. No password was changed.':e.message);process.exitCode=1;}finally{db.close();}
