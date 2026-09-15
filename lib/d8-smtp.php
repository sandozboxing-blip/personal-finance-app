<?php
declare(strict_types=1);

function d8SmtpRead($socket): string {
  $reply='';
  while(!feof($socket)){
    $line=(string)fgets($socket,515);$reply.=$line;
    if(strlen($line)>=4&&$line[3]===' ')break;
  }
  return $reply;
}
function d8SmtpCommand($socket,string $command,array $expected): string {
  if($command!=='')fwrite($socket,$command."\r\n");
  $reply=d8SmtpRead($socket);$code=(int)substr($reply,0,3);
  if(!in_array($code,$expected,true))throw new RuntimeException('SMTP '.$code);
  return $reply;
}
function d8SendSmtp(array $smtp,string $to,string $subject,string $body): void {
  $host=(string)($smtp['host']??'');$port=(int)($smtp['port']??465);$user=(string)($smtp['username']??'');$pass=(string)($smtp['password']??'');
  $from=(string)($smtp['from_email']??$user);$fromName=(string)($smtp['from_name']??'Digital Eight');
  if(!$host||!$user||!$pass||!filter_var($from,FILTER_VALIDATE_EMAIL)||!filter_var($to,FILTER_VALIDATE_EMAIL))throw new RuntimeException('SMTP configuration');
  $context=stream_context_create(['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false]]);
  $socket=@stream_socket_client('ssl://'.$host.':'.$port,$errno,$errstr,20,STREAM_CLIENT_CONNECT,$context);
  if(!$socket)throw new RuntimeException('connection '.(string)$errno);
  stream_set_timeout($socket,20);
  try{
    d8SmtpCommand($socket,'',[220]);d8SmtpCommand($socket,'EHLO digitaleight.bg',[250]);
    d8SmtpCommand($socket,'AUTH LOGIN',[334]);d8SmtpCommand($socket,base64_encode($user),[334]);d8SmtpCommand($socket,base64_encode($pass),[235]);
    d8SmtpCommand($socket,'MAIL FROM:<'.$from.'>',[250]);d8SmtpCommand($socket,'RCPT TO:<'.$to.'>',[250,251]);d8SmtpCommand($socket,'DATA',[354]);
    $safeSubject=str_replace(["\r","\n"],' ',trim($subject));$encodedSubject=function_exists('mb_encode_mimeheader')?mb_encode_mimeheader($safeSubject,'UTF-8','B',"\r\n"):$safeSubject;
    $encodedName=function_exists('mb_encode_mimeheader')?mb_encode_mimeheader($fromName,'UTF-8','B',"\r\n"):$fromName;
    $plain=str_replace(["\r\n","\r"],"\n",$body);$plain=str_replace("\n","\r\n",$plain);$plain=preg_replace('/^\./m','..',$plain);
    $headers=['Date: '.date(DATE_RFC2822),'From: '.$encodedName.' <'.$from.'>','Reply-To: '.$from,'To: <'.$to.'>','Subject: '.$encodedSubject,'Message-ID: <'.bin2hex(random_bytes(16)).'@digitaleight.bg>','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: quoted-printable','X-Mailer: Digital Eight Outreach'];
    $payload=implode("\r\n",$headers)."\r\n\r\n".quoted_printable_encode($plain)."\r\n.";
    d8SmtpCommand($socket,$payload,[250]);d8SmtpCommand($socket,'QUIT',[221]);
  }finally{fclose($socket);}
}