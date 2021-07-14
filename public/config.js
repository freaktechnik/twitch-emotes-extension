(function() {
    "use strict";
    var twitch = window.Twitch.ext;
    var CONFIG_VERSION = "1";
    var DEFAULT_FALSE = [
        'bttv_expanded',
        'ffz_expanded',
        'bttv_animated'
    ];
    var details = [];
    var hasSubEmotes = false;
    var received = {
        config: false,
        auth: false,
        ready() {
            return this.config && this.auth;
        }
    };
    var unsaved = false;
    function showUnsaved() {
        unsaved = true;
        document.getElementById("unsaved").className = '';
        document.getElementById("saved").className = 'hidden';
    }
    function hideUnsaved() {
        unsaved = false;
        document.getElementById("unsaved").className = 'hidden';
        document.getElementById("saved").className = '';
    }
    function hookUpDetails() {
        var detailsEditor = document.getElementsByClassName("details");
        for(var i = 0; i < detailsEditor.length; ++i) {
            detailsEditor[i].getElementsByTagName("textarea")[0].addEventListener("input", function() {
                var emote = this.getAttribute('data-name');
                var hadEmote = false;
                for(var j = 0; j < details.length; ++j) {
                    if(details[j].name === emote) {
                        hadEmote = true;
                        if(this.value.length) {
                            details[j].description = this.value;
                        }
                        else {
                            details.splice(j, 1);
                        }
                    }
                }
                if(!hadEmote && this.value.length) {
                    details.push({
                        name: emote,
                        description: this.value
                    });
                }
                updateConfiguration();
            }, false);
        }
    }
    function editEmote(item, emote) {
        var detailsEditor = item.parentNode.parentNode.getElementsByClassName('details')[0];
        if(item.className.indexOf('expandable') !== -1) {
            if(detailsEditor.className.indexOf('hidden') === -1) {
                for(var i = 0; i < item.parentNode.children.length; ++i) {
                    if(item.parentNode.children[i].className === 'highlighted') {
                        item.parentNode.children[i].className = 'expandable';
                    }
                }
            }
            item.className = item.className.replace('expandable', 'highlighted');
            var desc = detailsEditor.getElementsByTagName("textarea")[0];
            desc.setAttribute('data-name', emote.name);
            var existingDetails;
            for(var i = 0; i < details.length; ++i) {
                if(details[i].name === emote.name) {
                    existingDetails = details[i];
                    break;
                }
            }
            if(existingDetails) {
                desc.value = existingDetails.description;
            }
            else {
                desc.value = '';
            }

            var figure = detailsEditor.getElementsByTagName('figure')[0];
            var img = figure.getElementsByTagName('img')[0];
            img.src = emote.url || (emote.light && emote.light.animated && emote.light.animated.url);
            if(emote.hasOwnProperty('srcset')) {
                img.srcset = emote.srcset;
            }
            else if(emote.hasOwnProperty('light')) {
                img.srcset = emote.light.animated.srcset;
            }
            else {
                img.srcset = '';
            }
            img.alt = emote.name;
            img.title = emote.name;
            figure.getElementsByTagName('figcaption')[0].textContent = emote.name;

            detailsEditor.className = detailsEditor.className.replace('hidden', '');
        }
        else {
            item.className = item.className.replace('highlighted', 'expandable');
            detailsEditor.className += ' hidden';
        }
    }
    function addEmotes(sectionId, emotes, tooltipExtra) {
        tooltipExtra = tooltipExtra || '';
        var section = document.getElementById(sectionId + "-emotes");
        var bttvChecked = false;
        var cheerChecked = true;
        var cheerType = 'animated';
        var theme = document.body.className.indexOf('dark') === -1 ? 'light' : 'dark';
        if(sectionId == 'bttv') {
            var animated = document.getElementById("bttv_animated");
            bttvChecked = animated.checked;
            animated.addEventListener("change", function() {
                for(var j = 0; j < emotes.length; ++j) {
                    if(emotes[j].animated) {
                        var item = section.querySelector("[alt=\"" + emotes[j].name + "\"]").parentNode.parentNode;
                        if(this.checked) {
                            item.className = item.className.replace('invisible', '');
                        }
                        else {
                            item.className += ' invisible';
                        }
                    }
                }
            }, false);
        }
        if(sectionId == 'cheer' || sectionId == 'sub') {
            var hasAnimatedEmotes = sectionId == 'cheer';
            if(!hasAnimatedEmotes) {
                for(var l = 0; l < emotes.length; ++l) {
                    if(!emotes[l].url) {
                        hasAnimatedEmotes = true;
                        break;
                    }
                }
            }
            if(hasAnimatedEmotes) {
                var cheerAnimated = document.getElementById(sectionId + "_animated");
                cheerChecked = cheerAnimated.checked;
                cheerType = cheerChecked ? 'animated' : 'static';
                cheerAnimated.addEventListener("change", function() {
                    theme = document.body.className.indexOf('dark') === -1 ? 'light' : 'dark';
                    cheerType = this.checked ? 'animated' : 'static';
                    for(var k = 0; k < emotes.length; ++k) {
                        if(!emotes[k].url) {
                            var item = section.querySelector("[alt=\"" + emotes[k].name + "\"]");
                            item.src = emotes[k][theme][cheerType].url;
                            item.srcset = emotes[k][theme][cheerType].srcset;
                        }
                    }
                });
            }
        }
        for(var i = 0; i < emotes.length; ++i) {
            var emote = emotes[i];
            var image = new Image(emote.width, emote.height);
            if(!emote.url) {
                image.src = emote[theme][cheerType].url;
                image.srcset = emote[theme][cheerType].srcset;
            }
            else {
                image.src = emote.url;
            }
            image.alt = emote.name;
            image.title = emote.name + tooltipExtra;
            if(emote.hasOwnProperty("srcset")) {
                image.srcset = emote.srcset;
            }
            var figure = document.createElement("figure");
            figure.appendChild(image);
            var item = document.createElement("li");
            item.className = 'expandable';
            if(sectionId == 'bttv' && emote.animated && !bttvChecked) {
                item.className += ' invisible';
            }
            item.addEventListener('click', editEmote.bind(null, item, emote), false);
            item.appendChild(figure);
            section.appendChild(item);
        }
    }
    function updateDefaults() {
        if(!hasSubEmotes && received.ready() && !twitch.configuration.broadcaster) {
            for(var k = 0; k < DEFAULT_FALSE.length; ++k) {
                document.getElementById(DEFAULT_FALSE[k]).checked = true;
            }
            DEFAULT_FALSE.length = 0;
            updateConfiguration();
        }
    }
    twitch.onContext(function(context) {
        if(document.body.className.indexOf('dark') + document.body.className.indexOf('light') === -2) {
            document.body.className += ' ' + context.theme;
        }
        else {
            document.body.className = document.body.className.replace(/light|dark/, context.theme);
            document.getElementById("cheer_animated").dispatchEvent(new Event('change'));
            document.getElementById("sub_animated").dispatchEvent(new Event('change'));
        }
    });
    twitch.onAuthorized(function(auth) {
        // Race condition
        if(!window.EmotesModel.channelId) {
            window.EmotesModel.setAuth(auth);
        }
        window.EmotesModel.getChannelInfo().then(function() {
            var gracefulFail = function() { return []; };
            document.getElementById("broadcaster_name_override").setAttribute("placeholder", window.EmotesModel.username);
            if(!window.EmotesModel.canHaveCheermotes) {
                document.getElementById("cheermotes-wrapper").className = 'hidden';
            }
            if(!window.EmotesModel.canHaveEmotes) {
                document.getElementById("sub-wrapper").className = 'hidden';
                document.getElementById("follower-wrapper").className = 'hidden';
                document.getElementById("bitstier-wrapper").className = 'hidden';
            }
            return Promise.all([
                window.EmotesModel.getEmotes().catch(gracefulFail),
                window.EmotesModel.getBTTVEmotes().catch(gracefulFail),
                window.EmotesModel.getFFZEmotes().catch(gracefulFail),
                window.EmotesModel.getCheerEmotes().catch(gracefulFail)
            ]);
        }).then(function(emotes) {
            var sectionIds = [
                'sub',
                'bttv',
                'ffz',
                'cheer'
            ];
            received.auth = true;
            for(var i = 0; i < emotes.length; ++i) {
                if(sectionIds[i] == 'sub') {
                    var collections = Array.isArray(emotes[i]) ? [] : Object.keys(emotes[i]);
                    for(var j = 0; j < collections.length; ++j) {
                        var collection = collections[j];
                        var collectionEmotes = emotes[i][collection];
                        if(collection.startsWith('subscriptions')) {
                            var tier = collection.slice('subscriptions'.length)[0];
                            addEmotes(sectionIds[i], collectionEmotes, " (Tier " + tier + ")");
                            if(!hasSubEmotes && collectionEmotes.length) {
                                hasSubEmotes = true;
                            }
                        }
                        else if(['bitstier', 'follower'].includes(collection)) {
                            addEmotes(collection, collectionEmotes);
                            if(!hasSubEmotes && collectionEmotes.length) {
                                hasSubEmotes = true;
                            }
                        }
                    }
                }
                else {
                    addEmotes(sectionIds[i], emotes[i]);
                }
            }
            if(hasSubEmotes) {
                document.getElementById("noEmotes").className = 'hidden';
            }
            updateDefaults();
        }).catch(function(e) {
            twitch.rig.log(e.message);
        });
    });
    twitch.configuration.onChanged(function() {
        window.EmotesModel.loadConfig();
        received.config = true;
        if(twitch.configuration.broadcaster && twitch.configuration.broadcaster.version == CONFIG_VERSION) {
            var data = JSON.parse(twitch.configuration.broadcaster.content);
            if(data.hasOwnProperty('shadows') && !data.shadows) {
                document.body.className = document.body.className.replace('shadows', '');
            }
            if(data.hasOwnProperty('details') && data.details.length) {
                details = data.details;
            }
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
    var saveTimeout = 3000; // can update the config 20 times every minute, so allow changes to be saved every three seconds.
    function actuallySave() {
        var inputs = document.getElementsByTagName('input');
        var data = {
            details: details
        };
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
        if(saveCallTimeout) {
            clearTimeout(saveCallTimeout);
        }
        saveCallTimeout = undefined;
        hideUnsaved();
    }
    function updateConfiguration() {
        var shadowInput = document.getElementById('shadows');
        if (!shadowInput.checked) {
            document.body.className = document.body.className.replace('shadows', '');
        }
        else if(document.body.className.indexOf('shadows') === -1) {
            document.body.className += ' shadows';
        }
        showUnsaved();
        if(saveCallTimeout) {
            clearTimeout(saveCallTimeout);
        }
        saveCallTimeout = setTimeout(actuallySave, saveTimeout);
    }
    function reset() {
        var inputs = document.getElementsByTagName('input');
        if(!document.body.className.indexOf('shadows') === -1) {
            document.body.className += ' shadows';
        }
        details = [];
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
        hookUpDetails();
    }, false);
    window.addEventListener("beforeunload", function(e) {
        if(unsaved) {
            e.preventDefault();
            e.returnValue = "Configuration not yet saved";
            actuallySave();
        }
    });
})();
