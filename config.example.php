<?php
// Copy this file to config.php on the server and set strong passwords.
// config.php is ignored by Git and must never be committed.
return [
  'users' => [
    'Admin'   => 'CHANGE-ME-TO-A-STRONG-PASSWORD',
    'Partner' => 'CHANGE-ME-TO-A-DIFFERENT-STRONG-PASSWORD'
  ],
  // App API Key is private. Add it only to config.php on the server.
  'onesignal' => [
    'app_id' => '258501b4-c99d-4ed1-92d3-3ce01d5c6242',
    'app_api_key' => 'PASTE-YOUR-ONESIGNAL-APP-API-KEY-HERE'
  ],
  // Google Maps lead extraction. Keep the key only in server config.php.
  'outscraper' => [
    'api_key' => 'PASTE-YOUR-OUTSCRAPER-API-KEY-HERE'
  ]
];
