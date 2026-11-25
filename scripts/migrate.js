import { sealTemplate } from '../src/templates.js';
import { db } from '../src/db.js';
import { now } from '../src/config.js';
import { demoTemplates } from '../src/demo-templates.js';
import { work1Template } from './work1-layout.js';
const carving=work1Template('private/prepared-assets/jyothi-carving-round-master.png');
// The first version remains in the sample order. This shop version accepts
// Unicode Malayalam recipient names under the fixed English college heading.
carving.id='shop-carving-jyothi-v2';
carving.version=2;
carving.font='malayalam';
carving.components[0].nameBox.font='malayalam';
carving.fields[0].label='Recipient name';
for(const template of [...demoTemplates,carving]){
  if(!db.prepare('SELECT id FROM templates WHERE id=?').get(template.id)){
    const sealed=sealTemplate(template);
    db.prepare('INSERT OR IGNORE INTO templates(id,doc,created_at) VALUES(?,?,?)').run(template.id,JSON.stringify(sealed),now());
  }
}
console.log('Database ready. Available templates include CARVING KANNADI R BIG with the fixed Jyothi Engineering College heading.');
db.close();
