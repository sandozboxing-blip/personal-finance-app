<?php
declare(strict_types=1);

function d8DecodeMime(string $value): string {
  if(function_exists('imap_mime_header_decode')){$parts=imap_mime_header_decode($value);$out='';foreach($parts as $part){$charset=strtoupper((string)$part->charset);$text=(string)$part->text;if($charset&&$charset!=='DEFAULT'&&$charset!=='UTF-8'&&function_exists('iconv'))$text=(string)@iconv($charset,'UTF-8//IGNORE',$text);$out.=$text;}return $out;}
  if(function_exists('iconv_mime_decode')){$decoded=@iconv_mime_decode($value,0,'UTF-8');if(is_string($decoded))return $decoded;}
  return $value;
}
function d8Pop3Line($conn): string {
  $line=fgets($conn,8192);if($line===false)throw new RuntimeException('POP3 връзката беше прекъсната');return rtrim($line,"\r\n");
}
function d8Pop3Command($conn,string $command,bool $multi=false): string {
  if(fwrite($conn,$command."\r\n")===false)throw new RuntimeException('POP3 командата не беше изпратена');$first=d8Pop3Line($conn);if(strncmp($first,'+OK',3)!==0)throw new RuntimeException('POP3: '.$first);if(!$multi)return $first;$lines=[];while(true){$line=d8Pop3Line($conn);if($line==='.')break;if(strncmp($line,'..',2)===0)$line=substr($line,1);$lines[]=$line;}return implode("\r\n",$lines);
}
function d8ParseMailHeaders(string $raw): array {
  $raw=preg_replace("/\r?\n[ \t]+/",' ',$raw)??$raw;$headers=[];foreach(preg_split("/\r?\n/",$raw)?:[] as $line){$pos=strpos($line,':');if($pos===false)continue;$headers[strtolower(trim(substr($line,0,$pos)))]=trim(substr($line,$pos+1));}return $headers;
}
function d8HeaderEmail(string $value): string {
  if(preg_match('/<([^>]+)>/',$value,$m))$value=$m[1];elseif(preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i',$value,$m))$value=$m[0];return strtolower(trim($value," \t\r\n\"'"));
}
function d8FetchReplyHeadersPop3(array $config): array {
  $smtp=is_array($config['smtp']??null)?$config['smtp']:[];$imap=is_array($config['imap']??null)?$config['imap']:[];$host=(string)($imap['host']??$smtp['host']??'mail.digitaleight.bg');$port=(int)($imap['pop3_port']??995);$user=(string)($imap['username']??$smtp['username']??'');$pass=(string)($imap['password']??$smtp['password']??'');if(!$user||!$pass)throw new RuntimeException('POP3 не е настроен');
  $errno=0;$error='';$conn=@stream_socket_client('ssl://'.$host.':'.$port,$errno,$error,15,STREAM_CLIENT_CONNECT);if(!$conn)throw new RuntimeException('POP3 връзката не успя: '.($error?:$errno));stream_set_timeout($conn,15);
  try{$hello=d8Pop3Line($conn);if(strncmp($hello,'+OK',3)!==0)throw new RuntimeException('POP3: '.$hello);d8Pop3Command($conn,'USER '.$user);d8Pop3Command($conn,'PASS '.$pass);$stat=d8Pop3Command($conn,'STAT');if(!preg_match('/^\+OK\s+(\d+)/',$stat,$m))return[];$count=(int)$m[1];$start=max(1,$count-299);$replies=[];$since=time()-45*86400;for($id=$start;$id<=$count;$id++){$raw=d8Pop3Command($conn,'TOP '.$id.' 0',true);$h=d8ParseMailHeaders($raw);$email=d8HeaderEmail((string)($h['from']??''));if(!filter_var($email,FILTER_VALIDATE_EMAIL)||$email===strtolower($user))continue;$ts=strtotime((string)($h['date']??''))?:time();if($ts<$since)continue;$messageId=trim((string)($h['message-id']??('pop3-'.$id)));$replies[]=['email'=>$email,'subject'=>d8DecodeMime((string)($h['subject']??'')),'date'=>gmdate('c',$ts),'messageId'=>$messageId,'mailbox'=>'INBOX (POP3)'];}return $replies;}finally{@fwrite($conn,"QUIT\r\n");@fclose($conn);}
}
function d8FetchReplyHeaders(array $config): array {
  if(!function_exists('imap_open'))return d8FetchReplyHeadersPop3($config);
  $smtp=is_array($config['smtp']??null)?$config['smtp']:[];$imap=is_array($config['imap']??null)?$config['imap']:[];
  $host=(string)($imap['host']??$smtp['host']??'mail.digitaleight.bg');$port=(int)($imap['port']??993);$user=(string)($imap['username']??$smtp['username']??'');$pass=(string)($imap['password']??$smtp['password']??'');
  if(!$user||!$pass)throw new RuntimeException('IMAP не е настроен');
  $root='{'.$host.':'.$port.'/imap/ssl}';$conn=@imap_open($root.'INBOX',$user,$pass,OP_READONLY,1);
  if(!$conn)throw new RuntimeException('IMAP входът не успя: '.(imap_last_error()?:'неизвестна грешка'));
  try{
    $mailboxes=[$root.'INBOX'];$listed=@imap_getmailboxes($conn,$root,'*')?:[];
    foreach($listed as $item){$full=(string)($item->name??'');$label=strtolower(str_replace($root,'',$full));if($full&&preg_match('~(^|[./])(spam|junk|bulk|bulk mail)$~i',$label)&&!in_array($full,$mailboxes,true))$mailboxes[]=$full;}
    $replies=[];$seen=[];
    foreach($mailboxes as $mailbox){if(!@imap_reopen($conn,$mailbox,OP_READONLY))continue;$ids=imap_search($conn,'SINCE "'.date('d-M-Y',strtotime('-45 days')).'"')?:[];$ids=array_slice($ids,-300);foreach($ids as $id){$h=imap_headerinfo($conn,(int)$id);$from=$h->from[0]??null;if(!$from)continue;$email=strtolower(trim((string)($from->mailbox??'').'@'.(string)($from->host??'')));if(!filter_var($email,FILTER_VALIDATE_EMAIL)||$email===strtolower($user))continue;$messageId=trim((string)($h->message_id??('imap-'.$mailbox.'-'.$id)));$key=$messageId.'|'.$email;if(isset($seen[$key]))continue;$seen[$key]=true;$replies[]=['email'=>$email,'subject'=>d8DecodeMime((string)($h->subject??'')),'date'=>isset($h->udate)?gmdate('c',(int)$h->udate):gmdate('c'),'messageId'=>$messageId,'mailbox'=>str_replace($root,'',$mailbox)];}}
    return $replies;
  }finally{imap_close($conn);}
}
function d8ApplyReplies(array &$state,array $replies): int {
  $byEmail=[];foreach($replies as $reply){$key=strtolower(trim((string)($reply['email']??'')));if($key)$byEmail[$key][]=$reply;}$updated=0;
  foreach($state['leads']??[] as &$lead){$email=strtolower(trim((string)($lead['email']??'')));if(!$email||empty($byEmail[$email]))continue;$out=is_array($lead['outreach']??null)?$lead['outreach']:[];$sentAt=(string)($out['sentAt']??'');if(!$sentAt&&!in_array((string)($out['status']??''),['sent','replied'],true))continue;$sentTs=$sentAt?strtotime($sentAt):0;$seen=is_array($out['replyMessageIds']??null)?$out['replyMessageIds']:[];foreach($byEmail[$email] as $reply){$replyTs=strtotime((string)($reply['date']??''))?:0;if($sentTs&&$replyTs&&$replyTs<$sentTs-300)continue;if(in_array($reply['messageId'],$seen,true))continue;$seen[]=$reply['messageId'];$out['status']='replied';$out['nextFollowupAt']='';$out['followupStatus']='stopped';$lead['followup']='';$out['replyAt']=$reply['date'];$out['replySubject']=$reply['subject'];$out['replyMailbox']=$reply['mailbox']??'INBOX';$out['replyCount']=(int)($out['replyCount']??0)+1;$out['updatedAt']=gmdate('c');$updated++;}$out['replyMessageIds']=array_slice($seen,-20);$lead['outreach']=$out;}
  unset($lead);return $updated;
}
