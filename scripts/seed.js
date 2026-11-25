import { sealTemplate } from '../src/templates.js';
import { db,run,one } from '../src/db.js';
import { createOrder,id,newLink } from '../src/domain.js';
import { now } from '../src/config.js';
import { demoTemplates } from '../src/demo-templates.js';
for(const t of demoTemplates)run('INSERT OR IGNORE INTO templates(id,doc,created_at) VALUES(?,?,?)',t.id,JSON.stringify(sealTemplate(t)),now());
const actor={id:'seed-command',role:'admin',username:'local-operator'};
const prior=one("SELECT value FROM settings WHERE key='demoOrderId'");
let result;
if(prior&&one('SELECT id FROM orders WHERE id=?',JSON.parse(prior.value)))result=newLink(actor,JSON.parse(prior.value));
else{result=createOrder(actor,{title:'Trichur Trophies — First Order',shared:{heading:'സ്നേഹാദരം',event:'',date:''},groups:[{templateId:demoTemplates[0].id,label:'479 C — personalised front',expectedQuantity:1}]});run("INSERT INTO settings(key,value) VALUES('demoOrderId',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify(result.order.id));}
console.log('Customer link (keep private): '+result.url);console.log('Staff dashboard: /staff. No account or password is created by seeding.');
db.close();

