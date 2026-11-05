import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const packageInfo=JSON.parse(await readFile('package.json','utf8'));
const files=['index.html','icon.svg','css/styles.css','js/app.js','js/core.js','data/demo.json'];
await mkdir('dist',{recursive:true});
const hashes={};
for(const file of files){await cp(file,`dist/${file}`,{recursive:true});hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');}
await writeFile('dist/.nojekyll','');
await writeFile('dist/version.json',JSON.stringify({version:packageInfo.version,commit:process.env.GITHUB_SHA||'local',files:hashes},null,2)+'\n');
console.log(`Built ${files.length} static assets + .nojekyll + version.json. No runtime dependencies.`);
