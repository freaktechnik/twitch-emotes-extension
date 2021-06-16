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
        curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/chat/emotes/?broadcaster_id='.$id);
        //TODO tiwtch api auth
        $data = curl_exec($ch);

        $channelInfo = json_decode($data, true);
        unset($data);
        $filePath = $basePath.$id.'.json';

        if(!isset($channelInfo['data'])) {
            if(is_file($filePath)) {
                unlink($filePath);
            }
        }
        else {
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
