// ── UTILS ──────────────────────────────────────────────
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n) { return Number(n || 0).toLocaleString('bg-BG', {maximumFractionDigits: 0}); }
function fmtD(d) { try { return new Date(d).toLocaleDateString('bg-BG', {day: '2-digit', month: 'short'}); } catch(e) { return d || ''; } }
function addMonths(date, m) { var d = new Date(date); d.setMonth(d.getMonth() + m); return d; }
function toast(msg, col) {
  var c = document.getElementById('toasts'); var t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = '<span style="color:' + col + '">●</span> ' + msg;
  c.appendChild(t); setTimeout(function() { t.classList.add('out'); setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 150); }, 3200);
}
function exportFullBackup() {
  var state = {version:4, exportedAt:new Date().toISOString(), leads:leads, smm:smm, web:web, tasks:sharedTasks, focusTasks:focusTasks, taskCategories:taskCategories, settings:userSettings};
  var blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'digital-eight-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('Пълният backup е свален', 'var(--green)');
}
function importFullBackup(event) {
  var input = event.target, file = input.files && input.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function() {
    try {
      var state = JSON.parse(String(reader.result || '{}'));
      if (!state || !Array.isArray(state.leads) || !Array.isArray(state.smm) || !Array.isArray(state.web)) throw new Error();
      if (!confirm('Това ще замени текущите данни с backup файла. Продължи?')) return;
      leads = state.leads; smm = state.smm; web = state.web; sharedTasks = Array.isArray(state.tasks) ? state.tasks : []; focusTasks=Array.isArray(state.focusTasks)?state.focusTasks:[]; taskCategories=Array.isArray(state.taskCategories)?state.taskCategories:[];userSettings=state.settings&&typeof state.settings==='object'?state.settings:{};
      normalizeData(); saveData(); populateCats(); updateBadges(); renderDash(); renderSmm(); renderWeb(); renderLeads(); renderTasks();
      toast('Backup-ът е възстановен и записан', 'var(--green)');
    } catch (e) { toast('Невалиден backup файл', 'var(--red)'); }
    finally { input.value = ''; }
  };
  reader.readAsText(file);
}
function nukeAll() {
  if (!confirm('Изтриваш ВСИЧКИ данни? Не може да се върне.')) return;
  leads = []; smm = []; web = []; saveData(); renderDash(); renderLeads(); updateBadges();
  toast('Всички данни изчистени', 'var(--red)');
}
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { closeLB(); closeAdd(); closeTaskEditor(); closeMobileMore(); } });

// ── INIT ───────────────────────────────────────────────
(function bootstrap(){
  setSyncState('loading','Проверка на сесията');
  fetch('api.php?action=me',{credentials:'same-origin'})
    .then(function(r){return r.json();})
    .then(function(d){if(d.authenticated)startApp(d.user);else showLogin();})
    .catch(function(){showLogin('Няма връзка със сървъра. Опитай отново.');});
})();
