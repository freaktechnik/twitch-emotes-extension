<?php
$clientId = "";
$clientSecret = "";

function getToken() {
    global $clientId, $clientSecret;
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://id.twitch.tv/oauth2/token');
    curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials&scope=&client_id='.$clientId.'&client_secret='.$clientSecret);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HEADER, 0);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $data = curl_exec($ch);
    curl_close($ch);
    unset($ch);
    $response = json_decode($data, true);
    $ttoken = $response['access_token'];
    $expires = time() + $response['expires_in'];
    $tokenFile = '<?php'.PHP_EOL.'$token='."'".$ttoken."'".';'.PHP_EOL.'$expires='.$expires.';'.PHP_EOL;
    file_put_contents(__DIR__.'/token.php', $tokenFile);
    return $ttoken;
}

function tokenIsValid($token, $expires) {
    if(empty($token)) {
        return false;
    }
    if($expires - time() >= 10) {
        return true;
    }
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://id.twitch.tv/oauth2/validate');
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: OAuth '.$token]);
    curl_setopt($ch, CURLOPT_HEADER, 0);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $data = curl_exec($ch);
    curl_close($ch);
    unset($ch);
    $response = json_decode($data, true);
    return $response['expires_in'] >= 10;
}
