(function() {
    "use strict";
    var twitch = window.Twitch.ext;
    var CONFIG_VERSION = "1";
    var DEFAULT_FALSE = [
        'bttv_expanded',
        'ffz_expanded'
    ];
    var hasSubEmotes = false;
    var received = {
        config: false,
        auth: false,
        ready() {
            return this.config && this.auth;
        }
    };
    function addEmotes(sectionId, emotes, tooltipExtra) {
        tooltipExtra = tooltipExtra || '';
        var section = document.getElementById(sectionId + "-emotes");
        for(var i = 0; i < emotes.length; ++i) {
            var emote = emotes[i];
            var image = new Image(emote.width, emote.height);
            image.src = emote.url;
            image.alt = emote.name;
            image.title = emote.name + tooltipExtra;
            if(emote.hasOwnProperty("srcset")) {
                image.srcset = emote.srcset;
            }
            var figure = document.createElement("figure");
            figure.appendChild(image);
            var item = document.createElement("li");
            item.appendChild(figure);
            section.appendChild(item);
        }
    }
    function updateDefaults() {
        if(!hasSubEmotes && received.ready() && !twitch.configuration.broadcaster) {
            twitch.rig.log("Set initial default config without sub emotes");
            for(var k = 0; k < DEFAULT_FALSE.length; ++k) {
                document.getElementById(DEFAULT_FALSE[k]).checked = true;
            }
            DEFAULT_FALSE.length = 0;
            updateConfiguration();
        }
    }
    twitch.onContext(function(context) {
        document.body.classList = context.theme;
    });
    twitch.onAuthorized(function(auth) {
        // Race condition
        if(!window.EmotesModel.channelId) {
          window.EmotesModel.setAuth(auth);
        }
        window.EmotesModel.getChannelInfo().then(function() {
            var gracefulFail = function() { return []; };
            return Promise.all([
                window.EmotesModel.getEmotes().catch(gracefulFail),
                window.EmotesModel.getBTTVEmotes().catch(gracefulFail),
                window.EmotesModel.getFFZEmotes().catch(gracefulFail)
            ]);
        }).then(function(emotes) {
            var sectionIds = [
                'sub',
                'bttv',
                'ffz'
            ];
            received.auth = true;
            for(var i = 0; i < emotes.length; ++i) {
                if(sectionIds[i] == 'sub') {
                    for(var j = 0; j < emotes[i].length; ++j) {
                        addEmotes(sectionIds[i], emotes[i][j].emotes, " (" + emotes[i][j].type + ")");
                        if(!hasSubEmotes && emotes[i][j].emotes.length) {
                            hasSubEmotes = true;
                        }
                    }
                }
                else {
                    addEmotes(sectionIds[i], emotes[i]);
                }
            }
            updateDefaults();
        }).catch(function(e) {
            twitch.rig.log(e.message);
        });
    });
    twitch.configuration.onChanged(function() {
        received.config = true;
        if(twitch.configuration.broadcaster && twitch.configuration.broadcaster.version == CONFIG_VERSION) {
            var data = JSON.parse(twitch.configuration.broadcaster.content);
            var keys = Object.keys(data);
            var id, input;
            var isDefault = true;
            for(var i = 0; i < keys.length; ++i) {
                id = keys[i];
                input = document.getElementById(id);
                if(!input) {
                    continue;
                }
                if(input.type == 'checkbox') {
                    input.checked = data[id];
                    if(isDefault && input.checked != (DEFAULT_FALSE.indexOf(input.id) === -1)) {
                        isDefault = false;
                    }
                }
                else {
                    input.value = data[id];
                    if(isDefault && input.value) {
                        isDefault = false;
                    }
                }
            }
            document.getElementById("reset").disabled = isDefault;
        }
        else {
            updateDefaults();
        }
    });
    var saveCallTimeout;
    var saveTimeout = 1000;
    function updateConfiguration() {
        //TODO add save indicator so stuff doesn't get lost.
        if(saveCallTimeout) {
            clearTimeout(saveCallTimeout);
        }
        saveCallTimeout = setTimeout(function() {
            var inputs = document.getElementsByTagName('input');
            var data = {};
            var isDefault = true;
            for(var i = 0; i < inputs.length; ++i) {
                if(inputs[i].type == 'checkbox') {
                    data[inputs[i].id] = inputs[i].checked;
                    if(isDefault && inputs[i].checked != (DEFAULT_FALSE.indexOf(inputs[i].id) === -1)) {
                        isDefault = false;
                    }
                }
                else {
                    data[inputs[i].id] = inputs[i].value;
                    if(isDefault && inputs[i].value) {
                        isDefault = false;
                    }
                }
            }
            twitch.configuration.set('broadcaster', CONFIG_VERSION, JSON.stringify(data));
            document.getElementById("reset").disabled = isDefault;
            saveCallTimeout = undefined;
        }, saveTimeout);
    }
    function reset() {
        var inputs = document.getElementsByTagName('input');
        for(var i = 0; i < inputs.length; ++i) {
            if(inputs[i].type == 'checkbox') {
                inputs[i].checked = DEFAULT_FALSE.indexOf(inputs[i].id) === -1;
            }
            else {
                inputs[i].value = '';
            }
        }
        updateConfiguration();
    }
    document.addEventListener("DOMContentLoaded", function() {
        var inputs = document.getElementsByTagName('input');
        for(var i = 0; i < inputs.length; ++i) {
            if(inputs[i].type == 'checkbox') {
                inputs[i].addEventListener("change", updateConfiguration, false);
            }
            else {
                inputs[i].addEventListener("input", updateConfiguration, false);
            }
        }
        document.getElementById('reset').addEventListener("click", reset);
    }, false);
})();
