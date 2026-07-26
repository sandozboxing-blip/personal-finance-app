// Optional calendar time and reminder UI.
(function(){
  'use strict';
  function injectFields(){
    var endField=document.getElementById('tmEndDateField');
    if(endField&&!document.getElementById('tmTime')){
      var label=document.createElement('label');label.className='taskdatefield tasktimefield';label.innerHTML='<span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg> ЧАС <em>по желание</em></span><input id="tmTime" class="fi" type="time" title="Час на събитието"><small>Известие 2 часа по-рано</small>';endField.insertAdjacentElement('afterend',label);
    }
    var editorEnd=document.getElementById('teEndDateField');
    if(editorEnd&&!document.getElementById('teTime')){
      var field=document.createElement('div');field.className='taskedit-time';field.innerHTML='<label class="flbl" for="teTime">Час <span>по желание</span></label><input id="teTime" class="fi" type="time"><small class="calendar-time-hint">Известието ще пристигне 2 часа по-рано.</small>';editorEnd.insertAdjacentElement('afterend',field);
    }
    if(!document.getElementById('calendarTimeStyles')){
      var style=document.createElement('style');style.id='calendarTimeStyles';style.textContent='.tasktimefield input[type=time],.taskedit-time input[type=time]{color-scheme:dark}';document.head.appendChild(style);
    }
  }
  injectFields();
  var originalPeriodLabel=window.taskPeriodLabel;
  if(typeof originalPeriodLabel==='function')window.taskPeriodLabel=function(task,startIso){var label=originalPeriodLabel(task,startIso);return label+(task&&task.time?' · '+task.time:'');};
  var originalAdd=window.addManagerTask;
  if(typeof originalAdd==='function')window.addManagerTask=function(){injectFields();var time=document.getElementById('tmTime').value||'',before=getTasks().map(function(t){return t.id;});originalAdd();var created=getTasks().find(function(t){return before.indexOf(t.id)<0;});if(created){created.time=time;saveTasks(getTasks());document.getElementById('tmTime').value='';renderTaskManager();}};
  var originalOpen=window.openTaskEditor;
  if(typeof originalOpen==='function')window.openTaskEditor=function(id){injectFields();originalOpen(id);var task=getTasks().find(function(t){return t.id===id;});document.getElementById('teTime').value=task&&task.time?task.time:'';};
  var originalSave=window.saveTaskEditor;
  if(typeof originalSave==='function')window.saveTaskEditor=function(){injectFields();var id=document.getElementById('teId').value,time=document.getElementById('teTime').value||'';originalSave();if(!document.getElementById('taskEditOv').classList.contains('open')){var task=getTasks().find(function(t){return t.id===id;});if(task){task.time=time;saveTasks(getTasks());renderTaskManager();}}};
})();
