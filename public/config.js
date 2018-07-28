var twitch = window.Twitch.ext;
twitch.onContext(function(context) {
    document.body.classList = context.theme;
});
