/**
 * 운동일지 ↔ Google 시트 동기화 백엔드 (Apps Script)
 *
 * 사용법은 같은 폴더의 설정방법.md 참고.
 * 요약:
 *   1) Google 시트 하나 만들기 → 확장 프로그램 > Apps Script
 *   2) 기본 코드를 지우고 이 파일 전체를 붙여넣고 저장
 *   3) 배포 > 새 배포 > 유형: 웹 앱
 *        - 실행 계정: 나
 *        - 액세스 권한: 모든 사용자
 *   4) 나온 웹 앱 URL(.../exec)을 운동일지 앱의 ☁ 버튼에 붙여넣기
 *
 * 데이터는 숨김 시트 '_db'의 A열에 JSON을 청크 단위로 나눠 저장됩니다(정확한 원본).
 * 셀 하나에 다 넣으면 Google 시트의 셀당 5만자 한도에 걸려 기록이 많아지면 저장이
 * 조용히 실패하므로, 여러 행에 나눠 쓰고 불러올 때 이어붙입니다.
 * 사람이 보기 좋은 표는 '기록' 시트에 자동 생성됩니다(보기 전용, 직접 편집 금지).
 */

var DB_SHEET = '_db';
var VIEW_SHEET = '기록';
var CHUNK_SIZE = 45000; // 셀당 5만자 한도보다 여유를 둔 청크 크기

function doGet(e){ return route_(e); }
function doPost(e){ return route_(e); }

function route_(e){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var action = (e && e.parameter && e.parameter.action) || 'load';
    var data = null;
    if (e && e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        action = body.action || action;
        data = body.data;
      } catch (err) {}
    }
    if (action === 'save') {
      saveData_(Array.isArray(data) ? data : []);
      return out_({ ok: true, count: (data || []).length });
    }
    return out_({ data: loadData_() });
  } finally {
    lock.releaseLock();
  }
}

function out_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function dbSheet_(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DB_SHEET);
  if (!sh) { sh = ss.insertSheet(DB_SHEET); sh.hideSheet(); }
  return sh;
}

// A열에 나눠 저장된 JSON 청크를 전부 읽어 이어붙임 (예전 단일 A1 저장 방식과도 호환)
function loadData_(){
  var sh = dbSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 1) return [];
  var values = sh.getRange(1, 1, lastRow, 1).getValues();
  var raw = values.map(function(r){ return r[0] || ''; }).join('');
  if (!raw) return [];
  try {
    var d = JSON.parse(raw);
    return Array.isArray(d) ? d : [];
  } catch (err) { return []; }
}

// JSON을 셀당 CHUNK_SIZE 글자씩 나눠 A열 여러 행에 저장 (셀 하나에 다 넣으면 5만자 한도에 걸림)
function saveData_(data){
  var json = JSON.stringify(data);
  var chunks = [];
  for (var i = 0; i < json.length; i += CHUNK_SIZE) {
    chunks.push([json.slice(i, i + CHUNK_SIZE)]);
  }
  if (chunks.length === 0) chunks = [['']];
  var sh = dbSheet_();
  sh.clearContents(); // 이전보다 청크 수가 줄었을 때 남은 옛 청크가 안 섞이게 먼저 비움
  sh.getRange(1, 1, chunks.length, 1).setValues(chunks);
  writeView_(data);
}

// 운동의 세트행 배열 반환 (신형 rows[] 우선, 구형 단일 무게/세트/횟수 호환)
function exRows_(ex){
  if (!ex) return [];
  if (Array.isArray(ex.rows)) return ex.rows;
  if (ex.weight || ex.sets || ex.reps) return [{ weight: ex.weight, sets: ex.sets, reps: ex.reps, rir: ex.rir }];
  return [];
}

// 사람이 보기 좋은 표 자동 생성 (보기 전용 — 여기서 직접 편집해도 앱엔 반영되지 않습니다)
function writeView_(data){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(VIEW_SHEET);
  if (!sh) sh = ss.insertSheet(VIEW_SHEET);
  sh.clearContents();
  var header = ['날짜', '출처', '메모', '운동명', '무게', '세트', '횟수', 'RIR', '운동메모'];
  var rows = [header];
  var srcLabel = { personal: '개인일지', session: '세션지', planned: '예정' };
  data.slice().sort(function(a, b){
    return String(a.date).localeCompare(String(b.date));
  }).forEach(function(s){
    var exs = Array.isArray(s.exercises) ? s.exercises : [];
    if (exs.length === 0) {
      rows.push([s.date || '', srcLabel[s.src] || s.src || '', s.memo || '', '', '', '', '', '', '']);
      return;
    }
    exs.forEach(function(ex){
      var setRows = exRows_(ex);
      if (setRows.length === 0) {
        rows.push([s.date || '', srcLabel[s.src] || s.src || '', s.memo || '', ex.name || '', '', '', '', '', ex.note || '']);
      } else {
        setRows.forEach(function(r){
          rows.push([
            s.date || '', srcLabel[s.src] || s.src || '', s.memo || '',
            ex.name || '', r.weight || '', r.sets || '', r.reps || '', r.rir || '', ex.note || ''
          ]);
        });
      }
    });
  });
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
}
