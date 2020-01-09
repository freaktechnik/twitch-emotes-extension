<?php
$channelId = $_GET['id'];
$basePath = __DIR__.'/../api/emotesets/';
$filePath = $basePath.$channelId.'.json';
$errorCache = __DIR__.'/../api/cache/'.$channelId;

$hasError = is_file($errorCache);
if($hasError) {
    $stat = lstat($filePath);
    $mtime = $stat[9];
    if(time() - $mtime < 3600) {
        http_response_code(404);
        exit;
    }
}

if(is_file($filePath)) {
    $stat = lstat($filePath);
    $mtime = $stat[9];
    if(time() - $mtime < 60) {
        $response = file_get_contents($filePath);
        echo $filePath;
        exit;
    }
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.twitchemotes.com/api/v4/channels/'.$channelId);
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$data = curl_exec($ch);
curl_close($ch);
unset($ch);

$channelInfo = json_decode($data, true);
unset($data);
if(isset($channelInfo['error'])) {
    if($channelInfo['error'] === 'Channel not found') {
        touch($errorCache);
    }
    http_response_code(404);
    exit;
}

$response = json_encode($channelInfo['plans']);
file_put_contents($filePath, $response);

if($hasError) {
    unlink($errorCache);
}

echo $response;