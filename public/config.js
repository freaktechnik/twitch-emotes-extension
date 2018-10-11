var twitch = window.Twitch.ext;
var CONFIG_VERSION = "1";
var DEFAULT_FALSE = [
    'bttv_expanded',
    'ffz_expanded'
];
twitch.onContext(function(context) {
    document.body.classList = context.theme;
});
twitch.onAuthorized(function(auth) {
    //Don't care about this currently.
});
//TODO somehow default to expanding FFZ and BTTV when no config was saved yet and there are nos ub emotes.
twitch.configuration.onChanged(function() {
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
});
var saveCallTimeout;
var saveTimeout = 1000;
function updateConfiguration() {
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
