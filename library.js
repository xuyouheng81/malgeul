'use strict';
let notePress=null,pressedNote=null,pressedUntil=0,deleteTarget=null;
function endNotePress(){if(notePress){clearTimeout(notePress.timer);notePress.element?.classList?.remove('holding');notePress=null;}}
function beginNotePress(e,id){
  endNotePress();if(e.button!==0||e.isPrimary===false)return;
  const element=e.currentTarget;
  notePress={id,x:e.clientX,y:e.clientY,element,timer:setTimeout(()=>{
    pressedNote=id;pressedUntil=Date.now()+1600;endNotePress();requestNoteDelete(id);
  },650)};
  element.classList.add('holding');
}
function moveNotePress(e){if(notePress&&Math.hypot(e.clientX-notePress.x,e.clientY-notePress.y)>10)endNotePress();}
function consumeNotePress(id){if(id===pressedNote&&Date.now()<pressedUntil){pressedNote=null;return true;}return false;}
function requestNoteDelete(id){
  if(saving){$('libraryStatus').textContent='드라이브 저장이 끝나면 다시 삭제해 주세요.';return;}
  const n=notes.find(n=>n.id===id&&!n.deletedAt);if(!n)return;
  deleteTarget=id;$('deleteName').textContent=n.title||'제목 없는 기록';
  if(!$('deleteDialog').open)$('deleteDialog').showModal();
}
function deleteSelectedNote(){
  if(saving){$('libraryStatus').textContent='드라이브 저장 중입니다. 저장 후 다시 시도해 주세요.';return;}
  const n=notes.find(n=>n.id===deleteTarget&&!n.deletedAt);if(!n)return;
  n.deletedAt=new Date().toISOString();
  if(!persist()){delete n.deletedAt;$('libraryStatus').textContent='저장에 실패하여 삭제하지 않았습니다.';return;}
  $('deleteDialog').close();deleteTarget=null;
  if(selected===n.id){const next=notes.find(x=>!x.deletedAt);if(next){selected=next.id;render();}else newNote();}else list();
  $('libraryStatus').textContent='기록을 휴지통으로 이동했습니다. 휴지통에서 복원할 수 있습니다.';
}
function restoreDeletedNote(id){
  const n=notes.find(n=>n.id===id&&n.deletedAt);if(!n)return;
  const deleted=n.deletedAt;delete n.deletedAt;
  if(!persist()){n.deletedAt=deleted;$('libraryStatus').textContent='기기 저장에 실패해 복원하지 못했습니다.';return;}
  selected=n.id;$('search').value='';render();renderTrash();$('libraryStatus').textContent='기록을 복원했습니다.';
}
function renderTrash(){
  $('trashList').replaceChildren();const deleted=notes.filter(n=>n.deletedAt);
  if(!deleted.length){$('trashList').textContent='휴지통이 비어 있습니다.';return;}
  for(const n of deleted){const row=document.createElement('div');row.className='trashRow';const name=document.createElement('span');name.textContent=n.title||'제목 없는 기록';const button=document.createElement('button');button.textContent='복원';button.onclick=()=>restoreDeletedNote(n.id);row.append(name,button);$('trashList').append(row);}
}
$('confirmDelete').onclick=deleteSelectedNote;
$('cancelDelete').onclick=()=>{$('deleteDialog').close();deleteTarget=null;};
$('openTrash').onclick=()=>{renderTrash();$('trashDialog').showModal();};
$('closeTrash').onclick=()=>$('trashDialog').close();
document.addEventListener('scroll',endNotePress,true);
window.addEventListener('blur',endNotePress);
$('backupNotes').onclick=()=>{
  download(new Blob([JSON.stringify({format:'malgeul-backup',version:1,notes:notes.filter(n=>!n.deletedAt)},null,2)],{type:'application/json'}),'말글-기록백업-'+new Date().toISOString().slice(0,10)+'.json');
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
      if(notes.some(x=>!x.deletedAt&&x.created===n.created&&x.title===n.title&&x.text===n.text)){duplicates++;continue;}
      // A changed backup never overwrites a newer local note or cloud file.
      notes.unshift({id:crypto.randomUUID(),title:n.title.slice(0,120),text:n.text,created:n.created,revision:1,drive:{}});added++;
    }
    const saved=persist();$('search').value='';render();
    $('libraryStatus').textContent=added+'개 기록 복원 · 동일한 기록 '+duplicates+'개 건너뜀'+(saved?'':' · 기기 저장 실패: 백업 파일을 보관하세요.');
  }catch(e){$('libraryStatus').textContent=e.message||'백업을 읽지 못했습니다.';}
  finally{$('restoreFile').value='';}
};
