import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = path.dirname(fileURLToPath(import.meta.url));
const engraved = process.argv.includes('--engraved');
const refined = engraved || process.argv.includes('--refined');
const version = engraved ? 'moonmere_three_engraved' : refined ? 'moonmere_three_refined' : 'moonmere_three';
export const output = path.resolve(source,'../../output',version);
const compiled = await build({entryPoints:[path.join(source,'scene.js')],bundle:true,minify:true,
  define:{__MOONMERE_REFINED__:JSON.stringify(refined),__MOONMERE_ENGRAVED__:JSON.stringify(engraved)},
  format:'iife',target:'es2020',legalComments:'inline',write:false});
const page = await readFile(path.join(source,'viewer.html'),'utf8');
const license = await readFile(path.join(source,'node_modules/three/LICENSE'),'utf8');
const script = compiled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'moonmere.html'),page.replace('/*__MOONMERE__*/',
  ()=>'/*\n'+license+'\n*/\n'+script));
console.log(path.join(output,'moonmere.html'));
