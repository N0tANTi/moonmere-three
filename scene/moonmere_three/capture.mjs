import { output } from './build.mjs';
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const small = process.argv.includes('--preview');
const stillsOnly = small || process.argv.includes('--stills');
const destination = small ? path.join(root,'.local',path.basename(output)+'_review') : output;
const width = small ? 960 : 1920, height = small ? 540 : 1080;
await mkdir(destination,{recursive:true});

function ffmpegPath() {
  if(process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  if(process.platform!=='win32') return 'ffmpeg';
  const paths=spawnSync('where.exe',['ffmpeg'],{encoding:'utf8'}).stdout||'';
  for(const p of paths.trim().split(/\r?\n/)) {
    if(p && existsSync(p) && statSync(p).size>0) return p;
  }
  const dir=path.join(process.env.LOCALAPPDATA,'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe');
  if(existsSync(dir)) for(const item of readdirSync(dir)) {
    const p=path.join(dir,item,'bin/ffmpeg.exe');
    if(existsSync(p)) return p;
  }
  return 'ffmpeg';
}

function findAmbience() {
  for(const sub of ['moonmere_silver','moonmere','moonmere_three']) {
    const wav=path.join(root,'output',sub,'pond_at_night.wav');
    if(existsSync(wav)) return wav;
  }
  const localWav=path.join(output,'pond_at_night.wav');
  if(existsSync(localWav)) return localWav;
  const result=spawnSync(process.env.PYTHON||'python',['-c',
    "import sys; from pathlib import Path; from moonmere_audio import write_ambience; write_ambience(Path(sys.argv[1]))",localWav],
    {cwd:path.join(root,'scene'),encoding:'utf8'});
  if(result.status!==0) throw new Error('Unable to generate pond ambience. Python and NumPy are required. '+(result.stderr||''));
  return localWav;
}

const browser=await chromium.launch({
  ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {channel:'chrome'}),
  headless:true,args:['--enable-gpu','--ignore-gpu-blocklist','--disable-background-timer-throttling',
    ...(process.platform==='win32'?['--use-angle=d3d11']:[])]
});
let encoder, partial, encoderClosed;
try {
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const faults=[];
  page.on('pageerror',e=>faults.push(e.message));
  page.on('console',m=>{if(m.type()==='error') faults.push(m.text());});
  const url=pathToFileURL(path.join(output,'moonmere.html'));
  url.search=small?'capture=1&small=1':'capture=1';
  await page.goto(url.href,{waitUntil:'load',timeout:180000});
  if(faults.length) throw new Error(faults.join('\n'));
  await page.waitForFunction(()=>window.moonmere,undefined,{timeout:120000});
  console.log(await page.evaluate(()=>[moonmere.engine,moonmere.gpu].join(' | ')));
  async function picture(t,format) {
    const data=await page.evaluate(([time,type])=>{
      window.moonmere.render(time);
      return document.querySelector('canvas').toDataURL(type,.972).split(',')[1];
    },[t,format]);
    if(faults.length) throw new Error(faults.join('\n'));
    return Buffer.from(data,'base64');
  }
  for(const frame of [0,90,150,240,279,299]) {
    const name='frame_'+String(frame+1).padStart(3,'0')+'.png';
    await writeFile(path.join(destination,name),await picture(frame/30,'image/png'));
  }
  if(!stillsOnly) {
    const wav=findAmbience();
    partial=path.join(output,'moonmere.'+process.pid+'.rendering.mp4');
    encoder=spawn(ffmpegPath(),['-hide_banner','-loglevel','error','-y','-f','image2pipe',
      '-framerate','30','-vcodec','mjpeg','-i','pipe:0','-i',wav,'-map','0:v:0','-map','1:a:0',
      '-t','10','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-colorspace','bt709',
      '-vf','scale=out_color_matrix=bt709:out_range=tv','-color_primaries','bt709','-color_trc','bt709',
      '-c:a','aac','-b:a','192k','-movflags','+faststart',partial],{stdio:['pipe','ignore','inherit']});
    encoderClosed=new Promise(resolve=>encoder.once('close',resolve));
    encoder.stdin.on('error',()=>{});
    await once(encoder,'spawn');
    for(let frame=0;frame<300;frame++) {
      const jpeg=await picture(frame/30,'image/jpeg');
      await new Promise((resolve,reject)=>encoder.stdin.write(jpeg,e=>e?reject(e):resolve()));
      if((frame+1)%30===0) console.log('Encoded '+(frame+1)+' / 300');
    }
    encoder.stdin.end();
    const code=await encoderClosed;
    if(code!==0) throw new Error('FFmpeg exit '+code);
    await rename(partial,path.join(output,'moonmere.mp4'));
    partial=undefined;
  }
} finally {
  if(encoder && encoder.exitCode===null) encoder.kill();
  if(encoderClosed) await encoderClosed;
  if(partial) await rm(partial,{force:true});
  await browser.close();
}
