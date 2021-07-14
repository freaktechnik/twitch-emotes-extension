<?php
$newBase = realpath(__DIR__.'/../api/emotes/').'/';
if(!is_dir($newBase)) {
    mkdir($newBase, 0755, true);
}

$now = time();
$day = 60 * 60 * 24;
$it = new FilesystemIterator($newBase);
foreach($it as $file) {
    if($now - $file->getCTime() >= $day && $file->getFilename() !== '.htaccess') {
        unlink($newBase.$file->getFilename());
    }
}
