# Emotes Showcase

Twitch extension that shows off the emotes of a channel.

Built for the Twitch Extension Jam 2018.

## Usage

To be used in conjuction with the [Twitch extension developer rig](https://github.com/twitchdev/developer-rig) when developing, else it is available on Twitch: https://www.twitch.tv/ext/3yumzvi6r4wfycsk7vt1kbtto9s0n3

### Cron job

The extension uses a processed version of the data from [Twitchemotes](https://twitchemotes.com) hosted at api.emotes.ch. The API consists of a cloudflare worker.

## Build

`npm run build` generates a bundle to upload to Twitch. However, first the extension should be hosted in non-local mode by the rig, so necessary files are copied to the correct place.
