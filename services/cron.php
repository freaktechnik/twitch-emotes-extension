<?php
$basePath = __DIR__.'/../api/emotesets/';
if(!is_dir($basePath)) {
    mkdir($basePath, 0755, true);
}

//TODO remove files that are older than a month (and then potentially re-add them with the parser)
//TODO incremental cron

$directory = opendir($basePath);
if (!$directory) {
    exit;
}

$entry = readdir($directory);
$ch = curl_init();
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
while($entry !== false) {
    if ($entry[0] !== '.' && $entry !== '24261394.json') {
        list ( $id ) = explode('.', $entry);
        curl_setopt($ch, CURLOPT_URL, 'https://api.twitchemotes.com/api/v4/channels/'.$id);
        $data = curl_exec($ch);

        $channelInfo = json_decode($data, true);
        unset($data);
        $filePath = $basePath.$id.'.json';

        if(isset($channelInfo['error'])) {
            if(is_file($filePath)) {
                unlink($filePath);
            }
        }
        else {
            $response = json_encode($channelInfo['plans']);

            $shouldUpdate = true;
            if(is_file($filePath)) {
                $content = file_get_contents($filePath);
                if($content === $response) {
                    $shouldUpdate = false;
                }
            }
            if($shouldUpdate) {
                file_put_contents($filePath, $response);
            }
        }
    }
    $entry = readdir($directory);
}
curl_close($ch);
unset($ch);
closedir($directory);
