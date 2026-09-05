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
 * 저장되는 JSON은 { sessions, weights, meals } 세 묶음으로 구성됩니다(운동/체중/식단).
 * 예전 형식(세션 배열 하나만 저장하던 버전)도 그대로 읽혀서 자동 호환됩니다.
 * 사람이 보기 좋은 표는 '기록'(운동) / '체중' / '식단' 시트에 자동 생성됩니다
 * (모두 보기 전용 — 여기서 직접 편집해도 앱엔 반영되지 않습니다).
 */

var DB_SHEET = '_db';
var VIEW_SHEET = '기록';
var WEIGHT_VIEW_SHEET = '체중';
var MEAL_VIEW_SHEET = '식단';
var CHUNK_SIZE = 45000; // 셀당 5만자 한도보다 여유를 둔 청크 크기

function doGet(e){ return route_(e); }
function doPost(e){ return route_(e); }

function route_(e){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var action = (e && e.parameter && e.parameter.action) || 'load';
    var sessions = null, weights = null, meals = null;
    if (e && e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        action = body.action || action;
        sessions = body.data;
        weights = body.weights;
        meals = body.meals;
      } catch (err) {}
    }
    if (action === 'save') {
      var payload = {
        sessions: Array.isArray(sessions) ? sessions : [],
        weights: Array.isArray(weights) ? weights : [],
        meals: Array.isArray(meals) ? meals : []
      };
      saveData_(payload);
      return out_({ ok: true, count: payload.sessions.length });
    }
    var d = loadData_();
    return out_({ data: d.sessions, weights: d.weights, meals: d.meals });
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
  var empty = { sessions: [], weights: [], meals: [] };
  var sh = dbSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 1) return empty;
  var values = sh.getRange(1, 1, lastRow, 1).getValues();
  var raw = values.map(function(r){ return r[0] || ''; }).join('');
  if (!raw) return empty;
  try {
    var d = JSON.parse(raw);
    if (Array.isArray(d)) return { sessions: d, weights: [], meals: [] }; // 예전 형식(세션 배열만) 호환
    return {
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
      weights: Array.isArray(d.weights) ? d.weights : [],
      meals: Array.isArray(d.meals) ? d.meals : []
    };
  } catch (err) { return empty; }
}

// JSON을 셀당 CHUNK_SIZE 글자씩 나눠 A열 여러 행에 저장 (셀 하나에 다 넣으면 5만자 한도에 걸림)
function saveData_(payload){
  var json = JSON.stringify(payload);
  var chunks = [];
  for (var i = 0; i < json.length; i += CHUNK_SIZE) {
    chunks.push([json.slice(i, i + CHUNK_SIZE)]);
  }
  if (chunks.length === 0) chunks = [['']];
  var sh = dbSheet_();
  sh.clearContents(); // 이전보다 청크 수가 줄었을 때 남은 옛 청크가 안 섞이게 먼저 비움
  sh.getRange(1, 1, chunks.length, 1).setValues(chunks);
  writeView_(payload.sessions);
  writeWeightView_(payload.weights);
  writeMealView_(payload.meals);
}

// 운동의 세트행 배열 반환 (신형 rows[] 우선, 구형 단일 무게/세트/횟수 호환)
function exRows_(ex){
  if (!ex) return [];
  if (Array.isArray(ex.rows)) return ex.rows;
  if (ex.weight || ex.sets || ex.reps) return [{ weight: ex.weight, sets: ex.sets, reps: ex.reps, rir: ex.rir }];
  return [];
}

// 사람이 보기 좋은 운동 기록 표 자동 생성 (보기 전용 — 여기서 직접 편집해도 앱엔 반영되지 않습니다)
function writeView_(sessions){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(VIEW_SHEET);
  if (!sh) sh = ss.insertSheet(VIEW_SHEET);
  sh.clearContents();
  var header = ['날짜', '출처', '메모', '운동명', '무게', '세트', '횟수', 'RIR', '운동메모'];
  var rows = [header];
  var srcLabel = { personal: '개인일지', session: '세션지', planned: '예정' };
  (sessions || []).slice().sort(function(a, b){
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

// 사람이 보기 좋은 체중 기록 표 자동 생성 (보기 전용)
function writeWeightView_(weights){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(WEIGHT_VIEW_SHEET);
  if (!sh) sh = ss.insertSheet(WEIGHT_VIEW_SHEET);
  sh.clearContents();
  var header = ['날짜', '체중', '체지방률(%)', '메모'];
  var rows = [header];
  (weights || []).slice().sort(function(a, b){
    return String(a.date).localeCompare(String(b.date));
  }).forEach(function(w){
    rows.push([w.date || '', w.weight || '', w.bodyFat || '', w.memo || '']);
  });
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
}

// 사람이 보기 좋은 식단 기록 표 자동 생성 (보기 전용)
function writeMealView_(meals){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(MEAL_VIEW_SHEET);
  if (!sh) sh = ss.insertSheet(MEAL_VIEW_SHEET);
  sh.clearContents();
  var header = ['날짜', '끼니', '음식', '칼로리', '탄수화물(g)', '지방(g)', '단백질(g)', '식사메모', '하루메모'];
  var rows = [header];
  (meals || []).slice().sort(function(a, b){
    return String(a.date).localeCompare(String(b.date));
  }).forEach(function(m){
    var items = Array.isArray(m.meals) ? m.meals : [];
    if (items.length === 0) {
      rows.push([m.date || '', '', '', '', '', '', '', '', m.memo || '']);
      return;
    }
    items.forEach(function(x){
      rows.push([
        m.date || '', x.type || '', x.food || '', x.calories || '',
        x.carbs || '', x.fat || '', x.protein || '', x.memo || '', m.memo || ''
      ]);
    });
  });
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
}
