<?php

$channelId = $_GET['id'];
$newBase = __DIR__.'/../api/emotes/';
$newFile = $newBase.$channelId.'.json';
$errorCache = __DIR__.'/../api/cache/'.$channelId;
$emoteTypeCache = __DIR__.'/../api/types/';

//TODO require JWT

function sendHeaders($error = false) {
    header('Access-Control-Allow-Origin: https://3yumzvi6r4wfycsk7vt1kbtto9s0n3.ext-twitch.tv');
    header('Content-Type: application/json');
    if($error) {
        header('Cache-Control: public, max-age=60, s-maxage=60');
    }
    else {
        header('Cache-Control: public, max-age=86400, s-maxage=86400');
    }
}

function emotesV2Url($emoteId, $type, $theme, $density) {
    return 'https://static-cdn.jtvnw.net/emoticons/v2/'.$emoteId.'/'.$type.'/'.$theme.'/'.$density;
}

$hasError = is_file($errorCache);
if($hasError) {
    $stat = lstat($errorCache);
    $mtime = $stat[9];
    if(time() - $mtime < 3600) {
        http_response_code(404);
        sendHeaders(true);
        exit;
    }
}

if(is_file($newFile)) {
    $stat = lstat($newFile);
    $mtime = $stat[9];
    if(time() - $mtime < 60) {
        $response = file_get_contents($newFile);
        sendHeaders();
        echo $response;
        exit;
    }
}

require_once '../services/config.php';
if (is_file('../services/token.php')) {
    require_once '../services/token.php';
    if(!tokenIsValid($token, $expires)) {
        unset($token);
        $token = getToken();
    }
} else {
    $token = getToken();
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer '.$token, 'Client-ID: '.$clientId]);
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/users?id='.$channelId);
$userData = curl_exec($ch);
$userStatus = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
if($userStatus === 404) {
    touch($errorCache);
    http_response_code(404);
    sendHeaders(true);
    exit;
}
$parsedUser = json_decode($userData, true);
unset($userData);
if(empty($parsedUser['data'])) {
    touch($errorCache);
    http_response_code(404);
    sendHeaders(true);
    exit;
}

$channelInfo = [];
$cheermotes = [];
$forceEmotes = false;
if(!empty($parsedUser['data'][0]['broadcaster_type']) || $channelId == '24261394') {
    // dev override
    if($channelId == '24261394') {
        $forceEmotes = true;
        $channelId = '26610234';
    }
    curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/chat/emotes/?broadcaster_id='.$channelId);
    $data = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);

    $channelInfo = json_decode($data, true);
    unset($data);

    if($parsedUser['data'][0]['broadcaster_type'] === 'partner' || $forceEmotes) {
        curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/bits/cheermotes?broadcaster_id='.$channelId);
        $cheermoteData = curl_exec($ch);
        $cheermotes = json_decode($cheermoteData, true);
        unset($cheermoteData);
    }
}

function makeSrcSet($emoteImages) {
    $srcset = [];
    foreach($emoteImages as $key => $image) {
        $density = explode('_', $key)[1];
        $srcset[] = $image.' '.$density;
    }
    return implode(', ', $srcset);
}

curl_setopt(CURLOPT_HTTPHEADER, []);

function formatAnimatedEmote($id) {
    $ret = [];
    foreach(['dark', 'light'] as $theme) {
        foreach(['static', 'animated'] as $type) {
            $ret[$theme][$type]['url'] = emotesV2Url($id, $type, $theme, '1.0');
            $srcset = [];
            foreach(['1.0' => 1, '2.0' => 2, '3.0' => 4] as $density => $times) {
                $srcset[] = emotesV2Url($id, $type, $theme, $density).' '.$times.'x';
            }
            $ret[$theme][$type]['srcset'] = implode(', ', $srcset);
        }
    }
    return $ret;
}

$formattedEmotes = [];
if(isset($channelInfo['data'])) {
    foreach($channelInfo['data'] as $emote) {
        $typeAndTier = $emote['emote_type'].$emote['tier'];
        $canBeAnimated = strpos($emote['id'], 'emotesv2') === 0 && $emote['emote_type'] === 'subscriptions' && ($parsedUser['data'][0]['broadcaster_type'] === 'partner' || $forceEmotes);
        $animated = $canBeAnimated && is_file($emoteTypeCache.'animated/'.$emote['id']);
        if($canBeAnimated && !$animated && !is_file($emoteTypeCache.'static/'.$emote['id'])) {
            curl_setopt($ch, CURLOPT_URL, emotesV2Url($emote['id'], 'animated', 'dark', '1.0'));
            curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $animated = $status !== 404;
            if($animated) {
                touch($emoteTypeCache.'animated/'.$emote['id']);
            }
            else {
                touch($emoteTypeCache.'static/'.$emote['id']);
            }
        }

        $key = $emote['emote_type'] === 'subscriptions' ? $typeAndTier : $emote['emote_type'];
        if (!$animated) {
            $formattedEmotes[$key][] = [
                'name' => $emote['name'],
                'url' => $emote['images']['url_1x'],
                'srcset' => makeSrcSet($emote['images']),
                'animated' => false,
            ];
        }
        else {
            $animatedEmote = formatAnimatedEmote($emote['id']);
            $animatedEmote['name'] = $emote['name'];
            $formattedEmotes[$key][] = $animatedEmote;
        }
    }
}

curl_close($ch);
unset($ch);

function formatTier($tier, $theme, $type) {
    $srcset = [];
    foreach($tier['images'][$theme][$type] as $scale => $url) {
        $srcset[] = $url.' '.$scale.'x';
    }
    return [
        'url' => $tier['images'][$theme][$type]['1'],
        'srcset' => implode(', ', $srcset),
    ];
}

$cheermotesFormatted = [];
$cheermotesStep1 = [];
if(array_key_exists('data', $cheermotes)) {
    $cheermotesStep1 = array_filter($cheermotes['data'], function($cheermote) {
        return $cheermote['type'] == 'channel_custom';
    });
    usort($cheermotesStep1, function($a, $b) {
        return $b['order'] - $a['order'];
    });
    foreach($cheermotesStep1 as $cheermote) {
        foreach($cheermote['tiers'] as $tier) {
            if($tier['can_cheer']) {
                $cheermotesFormatted[] = [
                    'name' => $cheermote['prefix'].$tier['id'],
                    'dark' => [
                        'static' => formatTier($tier, 'dark', 'static'),
                        'animated' => formatTier($tier, 'dark', 'animated'),
                    ],
                    'light' => [
                        'static' => formatTier($tier, 'light', 'static'),
                        'animated' => formatTier($tier, 'light', 'animated'),
                    ],
                ];
            }
        }
    }
}

$response = json_encode([
    'emotes' => $formattedEmotes,
    'username' => $parsedUser['data'][0]['login'],
    'type' => $parsedUser['data'][0]['broadcaster_type'],
    'cheermotes' => $cheermotesFormatted,
]);
file_put_contents($newFile, $response);

if($hasError) {
    unlink($errorCache);
}

sendHeaders();
echo $response;
