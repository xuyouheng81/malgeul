// Runs uploaded audio locally. No audio is sent to the model host.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
let busy = false;
self.onmessage = async ({data}) => {
  if (busy) return;
  busy = true;
  let transcriber;
  try {
    self.postMessage({type:'status',text:'음성 인식 모델을 준비하는 중… 처음에는 다운로드 시간이 필요합니다.'});
    transcriber = await pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{
      device:'wasm',dtype:'q8',progress_callback:p=>{
        if(p.status==='progress') self.postMessage({type:'status',text:'모델 다운로드 · '+p.file+' '+Math.round(p.progress||0)+'%'});
      }
    });
    self.postMessage({type:'status',text:'파일을 한국어 텍스트로 변환하는 중… 화면을 켜 두세요.'});
    const result = await transcriber(data.audio, {language:'korean',task:'transcribe',chunk_length_s:30,stride_length_s:5,return_timestamps:false});
    self.postMessage({type:'done',text:result.text});
  } catch(e) {
    self.postMessage({type:'error',text:e?.message||'음성 인식 처리 실패'});
  } finally {
    await transcriber?.dispose(); busy=false;
  }
};
