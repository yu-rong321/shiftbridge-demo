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
assert.equal(fixture.equipment.length,2);assert.equal(fixture.records.length,6);assert.equal(new Set([...fixture.records,...fixture.sops].map(x=>x.id)).size,10);
console.log('Static checks passed: local asset links, five routes, English metadata, mobile styles, keyboard focus, unique sources and no external runtime services.');
