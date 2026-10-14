'use strict';
// Separate from live recording; a completed import always creates a new note.
let importWorker=null,importJob=0,importBusy=false,importFile=null,importURL='',importClock,importWake;
const fileStatus=message=>{$('fileStatus').textContent=message;};
function importControls(busy){importBusy=busy;$('audioFile').disabled=busy;$('convertFile').disabled=busy||!importFile;$('cancelImport').hidden=!busy;$('fileProgress').hidden=!busy;}
function releaseImport(){clearInterval(importClock);importWorker?.terminate();importWorker=null;importWake?.release().catch(()=>{});importWake=null;importControls(false);}
function cancelImport(){importJob++;releaseImport();fileStatus('변환을 취소했습니다. 기존 기록은 그대로 유지됩니다.');}
function selectAudioFile(){
 if(importBusy)return;
 importFile=null;if(importURL)URL.revokeObjectURL(importURL);importURL='';$('filePreview').removeAttribute('src');$('filePreview').hidden=true;
 const file=$('audioFile').files?.[0];
 if(!file){fileStatus('변환할 녹음 파일을 선택하세요.');importControls(false);return;}
 if(!/\.(mp3|m4a|wav|ogg|webm|mp4|aac|flac)$/i.test(file.name)){fileStatus('MP3, M4A, WAV, OGG, WebM, MP4, AAC, FLAC 파일을 선택하세요.');importControls(false);return;}
 if(!file.size){fileStatus('빈 파일은 변환할 수 없습니다. 다른 녹음 파일을 선택해 주세요.');importControls(false);return;}
 importFile=file;importURL=URL.createObjectURL(file);$('filePreview').src=importURL;$('filePreview').hidden=false;fileStatus(file.name+' · '+(file.size/1024/1024).toFixed(1)+'MB');importControls(false);
}
async function convertAudioFile(){
 if(importBusy||!importFile)return;
 const file=importFile,job=++importJob;let decoder;
 importControls(true);$('fileElapsed').textContent='';fileStatus('음성 파일을 읽는 중…');
 const startTime=Date.now();importClock=setInterval(()=>{$('fileElapsed').textContent=Math.floor((Date.now()-startTime)/1000)+'초 경과';},1000);
 try {
   if(navigator.wakeLock) navigator.wakeLock.request('screen').then(lock=>{if(job===importJob&&importBusy)importWake=lock;else lock.release();}).catch(()=>{});
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Audio)throw new Error('이 브라우저는 음성 파일 처리를 지원하지 않습니다. Chrome을 사용해 주세요.');
   decoder=new Audio({sampleRate:16000});const bytes=await file.arrayBuffer();if(job!==importJob)return;
   const decoded=await decoder.decodeAudioData(bytes);await decoder.close();decoder=null;if(job!==importJob)return;
   if(!decoded.length||!Number.isFinite(decoded.duration))throw new Error('파일에 읽을 수 있는 음성이 없습니다.');
   if(decoded.sampleRate!==16000)throw new Error('이 브라우저에서 필요한 음성 샘플링을 지원하지 않습니다. 최신 Chrome을 사용해 주세요.');
   const audio=new Float32Array(decoded.length);
   for(let channel=0;channel<decoded.numberOfChannels;channel++){
     const samples=decoded.getChannelData(channel);
     for(let i=0;i<audio.length;i++)audio[i]+=samples[i]/decoded.numberOfChannels;
   }
   importWorker=new Worker('transcribe-worker.js',{type:'module'});
   importWorker.onmessage=({data})=>{
     if(job!==importJob)return;
     if(data.type==='status'){fileStatus(data.text);return;}
     if(data.type==='error'){fileStatus('변환 실패: '+data.text+' · 네트워크를 확인하거나 짧은 파일로 다시 시도하세요.');releaseImport();return;}
     if(data.type==='done'){
       const text=typeof data.text==='string'?data.text.trim():'';
       if(!text){fileStatus('인식된 말이 없습니다. 음성이 잘 들리는 파일인지 확인해 주세요.');releaseImport();return;}
       const n={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'').slice(0,120),text,created:new Date().toISOString(),revision:1,drive:{}};
       notes.unshift(n);selected=n.id;const saved=persist();$('search').value='';render();queue();
       fileStatus(saved?'변환 완료! 보관함에 저장했습니다. 언제든 목록에서 다시 열 수 있습니다.':'변환 완료 · 기기 저장 실패. 지금 TXT 다운로드 또는 전체 목록 백업으로 보관하세요.');releaseImport();
     }
   };
   importWorker.onerror=()=>{if(job!==importJob)return;fileStatus('변환 엔진을 실행하지 못했습니다. 인터넷 연결을 확인하고 Chrome에서 다시 시도하세요.');releaseImport();};
   importWorker.postMessage({audio},[audio.buffer]);
 }catch(e){if(job===importJob){fileStatus('변환하지 못했습니다: '+(e.message||'지원되지 않는 음성 형식입니다.')+' 브라우저에서 읽지 못하는 파일은 MP3 또는 WAV로 바꿔 주세요.');releaseImport();}}
 finally{if(decoder)await decoder.close().catch(()=>{});}
}
$('audioFile').onchange=selectAudioFile;$('convertFile').onclick=convertAudioFile;$('cancelImport').onclick=cancelImport;
window.addEventListener('beforeunload',e=>{if(importBusy){e.preventDefault();e.returnValue='';}});
