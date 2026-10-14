'use strict';
// Separate from live recording; a completed import always creates a new note.
let importWorker=null,importJob=0,importBusy=false,importFile=null,importURL='',importClock,importWake;
const fileStatus=message=>{$('fileStatus').textContent=message;};
function importControls(busy){importBusy=busy;$('audioFile').disabled=busy;$('convertFile').disabled=busy||!importFile;$('cancelImport').hidden=!busy;$('record').disabled=busy;$('fileProgress').hidden=!busy;}
function releaseImport(){clearInterval(importClock);importWorker?.terminate();importWorker=null;importWake?.release().catch(()=>{});importWake=null;importControls(false);}
function cancelImport(){importJob++;releaseImport();fileStatus('변환을 취소했습니다. 기존 기록은 그대로 유지됩니다.');}
function selectAudioFile(){
 if(importBusy)return;
 importFile=null;if(importURL)URL.revokeObjectURL(importURL);importURL='';$('filePreview').removeAttribute('src');$('filePreview').hidden=true;
 const file=$('audioFile').files?.[0];
 if(!file){fileStatus('변환할 녹음 파일을 선택하세요.');importControls(false);return;}
 if(!/\.(mp3|m4a|wav|ogg|webm|mp4|aac|flac)$/i.test(file.name)){fileStatus('MP3, M4A, WAV, OGG, WebM, MP4, AAC, FLAC 파일을 선택하세요.');importControls(false);return;}
 if(!file.size||file.size>20*1024*1024){fileStatus('파일은 0바이트보다 크고 20MB 이하여야 합니다. 긴 파일은 나눠서 변환해 주세요.');importControls(false);return;}
 importFile=file;importURL=URL.createObjectURL(file);$('filePreview').src=importURL;$('filePreview').hidden=false;fileStatus(file.name+' · '+(file.size/1024/1024).toFixed(1)+'MB');importControls(false);
}
async function convertAudioFile(){
 if(importBusy||!importFile)return;
 if(recording||starting){fileStatus('실시간 녹음을 종료한 뒤 파일을 변환해 주세요.');return;}
 const file=importFile,job=++importJob;let decoder;
 importControls(true);$('fileElapsed').textContent='';fileStatus('음성 파일을 읽는 중…');
 const startTime=Date.now();importClock=setInterval(()=>{$('fileElapsed').textContent=Math.floor((Date.now()-startTime)/1000)+'초 경과';},1000);
 try {
   if(navigator.wakeLock) navigator.wakeLock.request('screen').then(lock=>{if(job===importJob&&importBusy)importWake=lock;else lock.release();}).catch(()=>{});
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Audio||!window.OfflineAudioContext)throw new Error('이 브라우저는 음성 파일 처리를 지원하지 않습니다. Chrome을 사용해 주세요.');
   decoder=new Audio();const bytes=await file.arrayBuffer();if(job!==importJob)return;
   const decoded=await decoder.decodeAudioData(bytes);await decoder.close();decoder=null;if(job!==importJob)return;
   if(decoded.duration>600)throw new Error('현재 휴대폰용 변환은 파일당 10분까지 지원합니다. 파일을 나누어 주세요.');
   if(!decoded.length||!Number.isFinite(decoded.duration))throw new Error('파일에 읽을 수 있는 음성이 없습니다.');
   const renderer=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);
   const source=renderer.createBufferSource();source.buffer=decoded;source.connect(renderer.destination);source.start();
   const mono=await renderer.startRendering();if(job!==importJob)return;
   const audio=mono.getChannelData(0).slice();
   importWorker=new Worker('transcribe-worker.js',{type:'module'});
   importWorker.onmessage=({data})=>{
     if(job!==importJob)return;
     if(data.type==='status'){fileStatus(data.text);return;}
     if(data.type==='error'){fileStatus('변환 실패: '+data.text+' · 네트워크를 확인하거나 짧은 파일로 다시 시도하세요.');releaseImport();return;}
     if(data.type==='done'){
       const text=typeof data.text==='string'?data.text.trim():'';
       if(!text){fileStatus('인식된 말이 없습니다. 음성이 잘 들리는 파일인지 확인해 주세요.');releaseImport();return;}
       const n={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'').slice(0,120),text,created:new Date().toISOString(),revision:1,drive:{}};
       notes.unshift(n);selected=n.id;persist();render();queue();
       fileStatus('변환 완료! 새 기록에 저장했습니다. 내용을 확인하고 수정하세요.');releaseImport();
     }
   };
   importWorker.onerror=()=>{if(job!==importJob)return;fileStatus('변환 엔진을 실행하지 못했습니다. 인터넷 연결을 확인하고 Chrome에서 다시 시도하세요.');releaseImport();};
   importWorker.postMessage({audio},[audio.buffer]);
 }catch(e){if(job===importJob){fileStatus('변환하지 못했습니다: '+(e.message||'지원되지 않는 음성 형식입니다.')+' 브라우저에서 읽지 못하는 파일은 MP3 또는 WAV로 바꿔 주세요.');releaseImport();}}
 finally{if(decoder)await decoder.close().catch(()=>{});}
}
$('audioFile').onchange=selectAudioFile;$('convertFile').onclick=convertAudioFile;$('cancelImport').onclick=cancelImport;
window.addEventListener('beforeunload',e=>{if(importBusy){e.preventDefault();e.returnValue='';}});
