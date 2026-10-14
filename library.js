'use strict';
$('backupNotes').onclick=()=>{
  download(new Blob([JSON.stringify({format:'malgeul-backup',version:1,notes},null,2)],{type:'application/json'}),'말글-기록백업-'+new Date().toISOString().slice(0,10)+'.json');
  $('libraryStatus').textContent='전체 기록의 백업 다운로드를 시작했습니다.';
};
$('restoreNotes').onclick=()=>$('restoreFile').click();
$('restoreFile').onchange=async()=>{
  const file=$('restoreFile').files?.[0];if(!file)return;
  try {
    const backup=JSON.parse(await file.text());
    if(backup.format!=='malgeul-backup'||backup.version!==1||!Array.isArray(backup.notes))throw new Error('말글에서 만든 목록 백업 파일을 선택해 주세요.');
    if(!backup.notes.every(n=>n&&typeof n.id==='string'&&typeof n.title==='string'&&typeof n.text==='string'&&Number.isFinite(Date.parse(n.created))))throw new Error('백업 파일의 기록 형식이 올바르지 않습니다.');
    let added=0,duplicates=0;
    for(const n of backup.notes){
      if(notes.some(x=>x.created===n.created&&x.title===n.title&&x.text===n.text)){duplicates++;continue;}
      // A changed backup never overwrites a newer local note or cloud file.
      notes.unshift({id:crypto.randomUUID(),title:n.title.slice(0,120),text:n.text,created:n.created,revision:1,drive:{}});added++;
    }
    const saved=persist();$('search').value='';render();
    $('libraryStatus').textContent=added+'개 기록 복원 · 동일한 기록 '+duplicates+'개 건너뜀'+(saved?'':' · 기기 저장 실패: 백업 파일을 보관하세요.');
  }catch(e){$('libraryStatus').textContent=e.message||'백업을 읽지 못했습니다.';}
  finally{$('restoreFile').value='';}
};
