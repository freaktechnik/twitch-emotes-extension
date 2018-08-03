<?php
include_once(__DIR__.'/../vendor/autoload.php');
ini_set('memory_limit', '800M');

class CacheBuilder extends \JsonStreamingParser\Listener\IdleListener {
    private $level = 0;
    private $currentChannelID;
    private $currentInfo = [];
    private $inPlans = false;
    private $currPlan;
    private $basePath;

    public function __construct($basePath) {
        $this->basePath = $basePath;
    }
    public function startObject() {
        $this->level++;
        if($this->level == 3 && $this->inPlans) {
            $this->currentInfo = [];
        }
    }
    public function endObject() {
        if($this->level == 3 && $this->inPlans) {
            $filePath = $this->basePath.$this->currentChannelID.'.json';
            $json = json_encode($this->currentInfo);
            $shouldSave = true;
            if(is_file($filePath)) {
                $content = file_get_contents($filePath);
                $shouldSave = $content !== $json;
            }
            if($shouldSave) {
                file_put_contents($filePath, $json);
            }
        }
        $this->level--;
    }
    public function key($key) {
        if($this->level == 1) {
            $this->currentChannelID = $key;
            $this->inPlans = false;
        }
        else if($this->level == 2) {
            $this->inPlans = $key == 'plans';
        }
        else if($this->inPlans && $this->level == 3) {
            $this->currPlan = $key;
        }
    }

    public function value($value) {
        if($this->inPlans) {
            $this->currentInfo[$this->currPlan] = $value;
        }
    }
}

$fh = fopen('php://memory', 'r+');
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://twitchemotes.com/api_cache/v3/subscriber.json');
curl_setopt($ch, CURLOPT_FILE, $fh);
curl_exec($ch);
curl_close($ch);
unset($ch);
rewind($fh);

$basePath = __DIR__.'/../api/emotesets/';
if(!is_dir($basePath)) {
    mkdir($basePath, 0755, true);
}

//TODO remove files that are older than a month (and then potentially re-add them with the parser)

$listener = new CacheBuilder($basePath);
try {
    $parser = new \JsonStreamingParser\Parser($fh, $listener);
    $parser->parse();
}
catch(Exception $e) {
    throw $e;
}
finally {
    fclose($fh);
}
