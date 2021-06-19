<?php
$basePath = realpath(__DIR__.'/../api/emotesets/').'/';
$newBase = realpath(__DIR__.'/../api/emotes/').'/';
if(!is_dir($basePath)) {
    mkdir($basePath, 0755, true);
}
if(!is_dir($newBase)) {
    mkdir($newBase, 0755, true);
}

$it = new FilesystemIterator($basePath);
$now = time();
$day = 60 * 60 * 24;
foreach($it as $file) {
    if($now - $file->getCTime() >= $day && $file->getFilename() !== '.htaccess') {
        unlink($basePath.$file->getFilename());
    }
}
$it = new FilesystemIterator($newBase);
foreach($it as $file) {
    if($now - $file->getCTime() >= $day && $file->getFilename() !== '.htaccess') {
        unlink($newBase.$file->getFilename());
    }
}
