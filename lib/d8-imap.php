<?php
declare(strict_types=1);

function d8DecodeMime(string $value): string {
  if(function_exists('imap_mime_header_decode')){$parts=imap_mime_header_decode($value);$out='';foreach($parts as $part){$charset=strtoupper((string)$part->charset);$text=(string)$part->text;if($charset&&$charset!=='DEFAULT'&&$charset!=='UTF-8'&&function_exists('iconv'))$text=(string)@iconv($charset,'UTF-8//IGNORE',$text);$out.=$text;}return $out;}
  return $value;
}
function d8FetchReplyHeaders(array $config): array {
  if(!function_exists('imap_open'))throw new RuntimeException('PHP IMAP extension липсва');
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
