# fartmachine

This is a little hack that will play fart noises through Sonos devices on your local network. 

More specifically... this will stop the Pandora station currently playing on the Sonos, crank the volume up, play a fart mp3, return the volume back to normal and return to the Pandora station that was playing.

To run
* Edit the Sonos IP addresses in /config/hosts.json
* Run `npm install`
* Run `node app.js`
* Visit localhost:8080 in your browser
* Have fun