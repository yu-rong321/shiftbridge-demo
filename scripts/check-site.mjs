import {sopCatalog} from '../js/core.js';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const html=await readFile('index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))assert.ok((await stat(match[1])).isFile(),match[1]);
assert.match(html,/<html lang="en">/);
assert.match(html,/<meta name="viewport"/);
assert.match(html,/id="main"/);
assert.match(html,/aria-live="polite"/);
for(const route of ['overview','record','history','brief','knowledge'])assert.match(html,new RegExp(`href="#${route}"`));
const css=await readFile('css/styles.css','utf8');
assert.match(css,/@media\(max-width:640px\)/);
assert.match(css,/:focus-visible/);
for(const file of ['index.html','js/app.js','js/core.js','css/styles.css']){
 const text=await readFile(file,'utf8');
 assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(text),`${file} contains an external runtime URL`);
}
const fixture=JSON.parse(await readFile('data/demo.json','utf8'));
assert.equal(fixture.equipment.length,2);assert.equal(fixture.records.length,6);const sources=[...fixture.records,...fixture.sops];
assert.equal(new Set(sources.map(x=>x.id)).size,sources.length);
assert.equal(fixture.sops.length,6);
assert.match(fixture.guidedDemoNote,/ETCH-01/);
assert.match(await readFile('js/app.js','utf8'),/Start guided demo/);
assert.match(await readFile('js/app.js','utf8'),/Generate demo draft/);
for(const equipment of fixture.equipment){
  for(const topic of new Set(fixture.sops.filter(s=>s.equipmentId===equipment.id).map(s=>s.topic))){
    const catalog=sopCatalog(fixture,equipment.id,topic);
    assert.equal(catalog.error,'',`${equipment.id} ${topic}: ${catalog.error}`);
  }
}
console.log('Static checks passed: local asset links, five routes, English metadata, mobile styles, keyboard focus, unique sources, guided narrative, valid SOP version chains and no external runtime services.');
