<?php
declare(strict_types=1);
ini_set('display_errors','0');
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$config=require __DIR__.'/config.php';require_once __DIR__.'/lib/d8-imap.php';
$file=__DIR__.'/data/panel-data.php';if(!is_file($file))exit;
try{$replies=d8FetchReplyHeaders($config);}catch(Throwable $e){exit(1);}
$fh=fopen($file,'c+');if(!$fh||!flock($fh,LOCK_EX))exit(1);rewind($fh);$raw=(string)stream_get_contents($fh);$json=preg_replace('/^<\?php exit; \?>\s*/','',$raw);$state=json_decode($json?:'{}',true);if(!is_array($state))$state=[];
$updated=d8ApplyReplies($state,$replies);if($updated){$state['updatedAt']=gmdate('c');rewind($fh);ftruncate($fh,0);fwrite($fh,"<?php exit; ?>\n".json_encode($state,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));fflush($fh);}flock($fh,LOCK_UN);fclose($fh);echo $updated;