<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('Europe/Sofia');
$config=require __DIR__.'/config.php';
$os=is_array($config['onesignal']??null)?$config['onesignal']:[];
$appId=trim((string)($os['app_id']??''));
$apiKey=trim((string)($os['app_api_key']??''));
if($appId===''||$apiKey===''||strpos($apiKey,'PASTE-')!==false){fwrite(STDERR,"OneSignal is not configured in config.php\n");exit(1);}

function protectedJson(string $path):array{
  if(!is_file($path))return[];
  $raw=(string)file_get_contents($path);
  $json=preg_replace('/^<\?php exit; \?>\s*/','',$raw);
  $data=json_decode($json?:'{}',true);
  return is_array($data)?$data:[];
}
function occurrenceOn(array $task,DateTimeImmutable $date):bool{
  $raw=(string)($task['due']??'');if($raw==='')return false;
  $base=DateTimeImmutable::createFromFormat('!Y-m-d',$raw);if(!$base||$date<$base)return false;
  $repeat=(string)($task['repeat']??'none');
  if($repeat==='yearly')return$date->format('m-d')===$base->format('m-d');
  if($repeat==='monthly')return$date->format('d')===$base->format('d');
  if($repeat==='weekly')return((int)$base->diff($date)->format('%a'))%7===0;
  return$date->format('Y-m-d')===$base->format('Y-m-d');
}
function idempotency(string $seed):string{
  $h=hash('sha256',$seed);
  return substr($h,0,8).'-'.substr($h,8,4).'-4'.substr($h,13,3).'-a'.substr($h,17,3).'-'.substr($h,20,12);
}
function sendPush(string $appId,string $apiKey,string $user,array $task,string $occurrence,string $key):array{
  $time=trim((string)($task['time']??''));$category=trim((string)($task['category']??''));$text=trim((string)($task['text']??''));
  $title=$category!==''?$category:'Digital Eight Calendar';
  $body=$text!==''?$text:'Calendar event';
  $body.=' · '.$occurrence.($time!==''?' · '.$time:'');
  $payload=['app_id'=>$appId,'target_channel'=>'push','include_aliases'=>['external_id'=>[$user]],'headings'=>['bg'=>$title,'en'=>$title],'contents'=>['bg'=>$body,'en'=>$body],'url'=>'https://finance.management.digitaleight.bg/','data'=>['task_id'=>(string)($task['id']??''),'occurrence'=>$occurrence],'idempotency_key'=>idempotency($key)];
  $ch=curl_init('https://api.onesignal.com/notifications');
  curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>25,CURLOPT_HTTPHEADER=>['Authorization: Key '.$apiKey,'Content-Type: application/json; charset=utf-8'],CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
  $raw=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$error=curl_error($ch);curl_close($ch);
  $response=is_string($raw)?json_decode($raw,true):null;
  return['ok'=>$status>=200&&$status<300&&is_array($response)&&!empty($response['id']),'status'=>$status,'response'=>$response,'error'=>$error];
}

$state=protectedJson(__DIR__.'/data/panel-data.php');
$users=is_array($state['userData']??null)?$state['userData']:[];
$deliveryFile=__DIR__.'/data/calendar-notifications.php';
$fh=fopen($deliveryFile,'c+');
if(!$fh||!flock($fh,LOCK_EX)){fwrite(STDERR,"Cannot lock notification state\n");exit(1);}
rewind($fh);$raw=(string)stream_get_contents($fh);$json=preg_replace('/^<\?php exit; \?>\s*/','',$raw);$delivery=json_decode($json?:'{}',true);if(!is_array($delivery))$delivery=[];
$sent=is_array($delivery['sent']??null)?$delivery['sent']:[];
$now=new DateTimeImmutable('now');
$windowStart=isset($delivery['lastRun'])?new DateTimeImmutable((string)$delivery['lastRun']):$now->sub(new DateInterval('PT10M'));
if($windowStart<$now->sub(new DateInterval('P1D')))$windowStart=$now->sub(new DateInterval('P1D'));
$dateStart=$windowStart->sub(new DateInterval('P1D'))->setTime(0,0);$dateEnd=$now->add(new DateInterval('P1D'))->setTime(23,59,59);
$attempted=0;$delivered=0;
foreach($users as $user=>$profile){
  $tasks=is_array($profile['tasks']??null)?$profile['tasks']:[];
  foreach($tasks as $task){
    if(!is_array($task)||empty($task['due']))continue;
    if(($task['repeat']??'none')==='none'&&!empty($task['done']))continue;
    for($date=$dateStart;$date<=$dateEnd;$date=$date->add(new DateInterval('P1D'))){
      if(!occurrenceOn($task,$date))continue;
      $occurrence=$date->format('Y-m-d');
      $completed=is_array($task['completedDates']??null)?$task['completedDates']:[];if(in_array($occurrence,$completed,true))continue;
      $time=trim((string)($task['time']??''));
      $trigger=new DateTimeImmutable($occurrence.' '.($time!==''?$time:'00:00'),new DateTimeZone('Europe/Sofia'));
      if($time!=='')$trigger=$trigger->sub(new DateInterval('PT2H'));
      if($trigger<=$windowStart||$trigger>$now)continue;
      $taskId=(string)($task['id']??sha1((string)json_encode($task)));
      $deliveryKey=(string)$user.'|'.$taskId.'|'.$occurrence.'|'.($time?:'date');
      if(isset($sent[$deliveryKey]))continue;
      $attempted++;$result=sendPush($appId,$apiKey,(string)$user,$task,$occurrence,$appId.'|'.$deliveryKey);
      if($result['ok']){$sent[$deliveryKey]=['sentAt'=>$now->format(DATE_ATOM),'messageId'=>$result['response']['id']];$delivered++;}
      else fwrite(STDERR,"OneSignal failed for {$deliveryKey}: HTTP {$result['status']} {$result['error']}\n");
    }
  }
}
$cutoff=$now->sub(new DateInterval('P1Y'))->getTimestamp();
$sent=array_filter($sent,static function($item)use($cutoff):bool{return is_array($item)&&strtotime((string)($item['sentAt']??''))>=$cutoff;});
$delivery=['version'=>1,'lastRun'=>$now->format(DATE_ATOM),'sent'=>$sent];
$encoded=json_encode($delivery,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
ftruncate($fh,0);rewind($fh);fwrite($fh,"<?php exit; ?>\n".$encoded);fflush($fh);flock($fh,LOCK_UN);fclose($fh);
echo"Calendar notifications: attempted={$attempted}, delivered={$delivered}\n";
