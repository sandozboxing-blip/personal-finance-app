<?php
declare(strict_types=1);
ini_set('display_errors','0');
session_name('digital_eight_session');
session_set_cookie_params(['lifetime'=>60*60*24*30,'path'=>'/','secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off'),'httponly'=>true,'samesite'=>'Strict']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$config=require __DIR__.'/config.php';
$action=$_GET['action']??'';
function body(): array { $raw=file_get_contents('php://input'); $data=json_decode($raw?:'{}',true); return is_array($data)?$data:[]; }
function reply(array $data,int $code=200): void { http_response_code($code); echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
function requireLogin(): void { if(empty($_SESSION['user'])) reply(['ok'=>false,'error'=>'Необходим е вход'],401); }
function dataFile(): string { return __DIR__.'/data/panel-data.php'; }
if($action==='login'&&$_SERVER['REQUEST_METHOD']==='POST'){
  $b=body();$u=trim((string)($b['username']??''));$p=(string)($b['password']??'');$users=$config['users']??[];
  if(isset($users[$u])&&hash_equals((string)$users[$u],$p)){session_regenerate_id(true);$_SESSION['user']=$u;reply(['ok'=>true,'user'=>$u]);}
  reply(['ok'=>false,'error'=>'Грешно име или парола'],401);
}
if($action==='logout'){$_SESSION=[];if(ini_get('session.use_cookies')){$x=session_get_cookie_params();setcookie(session_name(),'',time()-42000,$x['path'],$x['domain']??'',(bool)$x['secure'],(bool)$x['httponly']);}session_destroy();reply(['ok'=>true]);}
if($action==='me'){reply(['ok'=>true,'authenticated'=>!empty($_SESSION['user']),'user'=>$_SESSION['user']??null]);}
requireLogin();
if($action==='load'&&$_SERVER['REQUEST_METHOD']==='GET'){
  $file=dataFile();if(!is_file($file))reply(['ok'=>true,'state'=>['version'=>1,'leads'=>[],'smm'=>[],'web'=>[],'tasks'=>[]]]);
  $json=file_get_contents($file);$json=preg_replace('/^<\?php exit; \?>\s*/','',$json?:'');$state=json_decode($json?:'{}',true);if(!is_array($state))$state=[];reply(['ok'=>true,'state'=>$state]);
}
if($action==='save'&&$_SERVER['REQUEST_METHOD']==='POST'){
  $state=body();foreach(['leads','smm','web','tasks'] as $key){if(!isset($state[$key])||!is_array($state[$key]))$state[$key]=[];}
  $state=['version'=>1,'updatedAt'=>gmdate('c'),'updatedBy'=>$_SESSION['user'],'leads'=>$state['leads'],'smm'=>$state['smm'],'web'=>$state['web'],'tasks'=>$state['tasks']];
  $json=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);if($json===false||strlen($json)>20*1024*1024)reply(['ok'=>false,'error'=>'Невалидни или твърде големи данни'],400);
  $file=dataFile();$fh=fopen($file,'c+');if(!$fh)reply(['ok'=>false,'error'=>'Папка data няма права за запис'],500);flock($fh,LOCK_EX);ftruncate($fh,0);rewind($fh);fwrite($fh,"<?php exit; ?>\n".$json);fflush($fh);flock($fh,LOCK_UN);fclose($fh);reply(['ok'=>true,'updatedAt'=>$state['updatedAt']]);
}
reply(['ok'=>false,'error'=>'Невалидна заявка'],404);
