<?php
declare(strict_types=1);
ini_set('display_errors','0');
$isHttps=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')||strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO']??''))==='https';
ini_set('session.use_strict_mode','1');
ini_set('session.gc_maxlifetime','43200');
session_name('digital_eight_session');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$isHttps,'httponly'=>true,'samesite'=>'Lax']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$config=require __DIR__.'/config.php';
$action=$_GET['action']??'';
function body(): array { $raw=file_get_contents('php://input'); $data=json_decode($raw?:'{}',true); return is_array($data)?$data:[]; }
function reply(array $data,int $code=200): void { http_response_code($code); echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
function requireLogin(): void { if(empty($_SESSION['user'])) reply(['ok'=>false,'error'=>'Необходим е вход'],401); }
function dataFile(): string { return __DIR__.'/data/panel-data.php'; }
function decodeState(string $raw): array { $json=preg_replace('/^<\?php exit; \?>\s*/','',$raw); $state=json_decode($json?:'{}',true); return is_array($state)?$state:[]; }
function emptyState(): array { return ['version'=>3,'leads'=>[],'smm'=>[],'web'=>[],'tasks'=>[],'userData'=>[]]; }
if($action==='login'&&$_SERVER['REQUEST_METHOD']==='POST'){
  $b=body();$u=trim((string)($b['username']??''));$p=(string)($b['password']??'');$users=$config['users']??[];
  if(isset($users[$u])&&hash_equals((string)$users[$u],$p)){session_regenerate_id(true);$_SESSION['user']=$u;reply(['ok'=>true,'user'=>$u]);}
  reply(['ok'=>false,'error'=>'Грешно име или парола'],401);
}
if($action==='logout'){$_SESSION=[];if(ini_get('session.use_cookies')){$x=session_get_cookie_params();setcookie(session_name(),'',time()-42000,$x['path'],$x['domain']??'',(bool)$x['secure'],(bool)$x['httponly']);}session_destroy();reply(['ok'=>true]);}
if($action==='me'){reply(['ok'=>true,'authenticated'=>!empty($_SESSION['user']),'user'=>$_SESSION['user']??null]);}
requireLogin();
if($action==='load'&&$_SERVER['REQUEST_METHOD']==='GET'){
  $file=dataFile();$state=is_file($file)?decodeState((string)file_get_contents($file)):emptyState();$user=(string)$_SESSION['user'];$allUsers=is_array($state['userData']??null)?$state['userData']:[];$profile=is_array($allUsers[$user]??null)?$allUsers[$user]:[];
  $legacyTasks=is_array($state['tasks']??null)?$state['tasks']:[];
  reply(['ok'=>true,'state'=>['version'=>3,'updatedAt'=>$state['updatedAt']??null,'leads'=>is_array($state['leads']??null)?$state['leads']:[],'smm'=>is_array($state['smm']??null)?$state['smm']:[],'web'=>is_array($state['web']??null)?$state['web']:[],'tasks'=>is_array($profile['tasks']??null)?$profile['tasks']:($user==='Admin'?$legacyTasks:[]),'focusTasks'=>is_array($profile['focusTasks']??null)?$profile['focusTasks']:[],'focusInitialized'=>array_key_exists('focusTasks',$profile),'taskCategories'=>is_array($profile['taskCategories']??null)?$profile['taskCategories']:[],'settings'=>is_array($profile['settings']??null)?$profile['settings']:[]]]);
}
if($action==='save'&&$_SERVER['REQUEST_METHOD']==='POST'){
  $incoming=body();foreach(['leads','smm','web','tasks','focusTasks','taskCategories'] as $key){if(!isset($incoming[$key])||!is_array($incoming[$key]))$incoming[$key]=[];}if(!isset($incoming['settings'])||!is_array($incoming['settings']))$incoming['settings']=[];
  $file=dataFile();$fh=fopen($file,'c+');if(!$fh)reply(['ok'=>false,'error'=>'Папка data няма права за запис'],500);flock($fh,LOCK_EX);rewind($fh);$existing=decodeState((string)stream_get_contents($fh));$userData=is_array($existing['userData']??null)?$existing['userData']:[];$user=(string)$_SESSION['user'];$userData[$user]=['tasks'=>$incoming['tasks'],'focusTasks'=>$incoming['focusTasks'],'taskCategories'=>$incoming['taskCategories'],'settings'=>$incoming['settings'],'updatedAt'=>gmdate('c')];
  $state=['version'=>3,'updatedAt'=>gmdate('c'),'updatedBy'=>$user,'leads'=>$incoming['leads'],'smm'=>$incoming['smm'],'web'=>$incoming['web'],'tasks'=>[],'userData'=>$userData];$json=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);if($json===false||strlen($json)>20*1024*1024){flock($fh,LOCK_UN);fclose($fh);reply(['ok'=>false,'error'=>'Невалидни или твърде големи данни'],400);}ftruncate($fh,0);rewind($fh);fwrite($fh,"<?php exit; ?>\n".$json);fflush($fh);flock($fh,LOCK_UN);fclose($fh);reply(['ok'=>true,'updatedAt'=>$state['updatedAt']]);
}
reply(['ok'=>false,'error'=>'Невалидна заявка'],404);