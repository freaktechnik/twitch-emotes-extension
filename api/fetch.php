<?php
$channelId = $_GET['id'];
$basePath = __DIR__.'/../api/emotesets/';
$filePath = $basePath.$channelId.'.json';
$errorCache = __DIR__.'/../api/cache/'.$channelId;

//TODO require JWT

$hasError = is_file($errorCache);
if($hasError) {
    $stat = lstat($filePath);
    $mtime = $stat[9];
    if(time() - $mtime < 3600) {
        http_response_code(404);
        exit;
    }
}

function sendHeaders() {
    header('Access-Control-Allow-Origin: https://3yumzvi6r4wfycsk7vt1kbtto9s0n3.ext-twitch.tv');
    header('Content-Type: application/json');
    header('Cache-Control: public, max-age=86400, s-maxage=86400');
}

if(is_file($filePath)) {
    $stat = lstat($filePath);
    $mtime = $stat[9];
    if(time() - $mtime < 60) {
        $response = file_get_contents($filePath);
        sendHeaders();
        echo $filePath;
        exit;
    }
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/chat/emotes/?broadcaster_id='.$channelId);
//TODO app token
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$data = curl_exec($ch);
curl_close($ch);
unset($ch);

$channelInfo = json_decode($data, true);
unset($data);
if(!isset($channelInfo['data'])) {
    //TODO do on 400?
    if($channelInfo['error'] === 'Channel not found') {
        touch($errorCache);
    }
    header('Cache-Control: max-age=60, s-maxage=60');
    http_response_code(404);
    exit;
}

$byTypeAndTier = [];
foreach($channelInfo['data'] as $emote) {
    $typeAndTier = $emote['emote_type'] + $emote['tier'];
    if($emote['emote_type'] === 'bitstier') {
        if(!in_array($emote['emote_set_id'], $byTypeAndTier['bitstier'])) {
            $byTypeAndTier['bitstier'][] = $emote['emote_set_id'];
        }
    }
    else {
        $byTypeAndTier[$typeAndTier] = $emote['emote_set_id'];
    }
}
$legacy = [
    '$4.99' => $byTypeAndTier['subscriptions1000'],
    '$9.99' => $byTypeAndTier['subscriptions2000'],
    '$24.99' => $byTypeAndTier['subscriptions3000']
];

$response = json_encode($legacy);
file_put_contents($filePath, $response);

if($hasError) {
    unlink($errorCache);
}

sendHeaders();
echo $response;
