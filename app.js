var restify = require('restify'),
    extend = require('extend'),
    async = require('async'),
    s = require('sonos');

var hosts = require('./config/hosts.json');
var farts = require('./config/farts.json');

var max_volume = 100; // out of 100

var htmlEntities = function (str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

var init = function(callback){
  async.each(hosts, function(host, callback){
    var i = hosts.indexOf(host);
    hosts[i].sonos = new s.Sonos(host.IP);
    hosts[i].av_transport = new s.Services.AVTransport(host.IP);
    hosts[i].control = new s.Services.RenderingControl(host.IP);
    hosts[i].is_farting = false;
    callback();
  }, function(){
    callback();
  });
};

init(function(){
  var server = restify.createServer();
  server.use(restify.queryParser());
  
  server.get('/farts', function(req, res, next){
    res.send(farts);
    next();
  })
  
  server.get('/hosts', function(req, res, next){
    var _hosts = [];
    async.eachSeries(hosts, function(host, callback){
      getCurrentSettings(host, function(err, data){
        _hosts.push({name: host.name, title: data.title, artist: data.artist, position: data.position, duration: data.duration, volume : data.volume});
        callback();
      });
    }, function(){
      res.send(_hosts);
      next();
    });
  })
  
  server.get('/fart', function(req, res, next){
    play_fart(parseInt(req.params.host), true, req.params.mp3);
    res.send('ok');
    next();
  })
  

  
  server.get(/\/?.*/, restify.serveStatic({
    directory: './public/',
    default: 'index.html'
  }));

  server.listen(8080, function() {
    console.log('%s listening at %s', server.name, server.url);
  });
});

var getCurrentSettings = function(host, callback){
  var sonos = host.sonos;
  var av_transport = host.av_transport;
  var control = host.control;
  async.parallel({
    "volume" : function(callback) {
      control.GetVolume({"InstanceID":0,"Channel":"Master"}, callback);
    },
    "current_media" : function(callback) {
      av_transport.GetMediaInfo({"InstanceID":0}, callback);
    },
    "current_track" : function(callback) {
      sonos.currentTrack(callback);
    },
    "device" : function(callback) {
      sonos.deviceDescription(callback);
    }
  }, function(err, results){
    // console.log(results);
    if (err) {
      return callback(err);
    }
    callback(null, {
      volume: results.volume.CurrentVolume,
      uri: results.current_media.CurrentURI,
      uri_metadata: results.current_media.CurrentURIMetaData,
      position: results.current_track.position,
      duration: results.current_track.duration,
      title: results.current_track.title,
      album: results.current_track.album,
      artist: results.current_track.artist,
      room: results.device.roomName
    })
  })
}

var play_fart = function(h, play_now, uri, callback){
  var sonos = hosts[h].sonos;
  var av_transport = hosts[h].av_transport;
  var control = hosts[h].control;

  getCurrentSettings(hosts[h], function(err, data){
    if (!hosts[h].is_farting && (play_now || data.duration - data.position <= 10)){
          async.waterfall([
            function(callback){
              console.log('Playing ' + uri + ' on ' + hosts[h].name);
              hosts[h].is_farting = true;
              sonos.stop(callback);
            },
            function(result, callback){
              control.SetVolume({"InstanceID":0,"Channel":"Master","DesiredVolume":max_volume}, callback);
            },
            function(result, callback){
              sonos.play(uri, callback);
            },
            function(result, callback){
              setTimeout(function(){
                callback(null, true);
              }, 5000);
            },
            function(result, callback){
              if (data) {
                control.SetVolume({"InstanceID":0,"Channel":"Master","DesiredVolume":data.volume}, callback);
              } else {
                callback(null, true);
              }
            },
            function(result, callback){
              if (data) {
                av_transport.SetAVTransportURI({
                  "InstanceID":0,
                  "CurrentURI":data.uri,
                  "CurrentURIMetaData": htmlEntities(data.uri_metadata)
                }, callback);
              } else {
                callback(null, true);
              }
            },
            function(result, callback){
              if (data) {
                sonos.play(callback); 
              } else {
                callback(null, true);
              }
            }
          ], function(err, result){
            setTimeout(function(){
              hosts[h].is_farting = false;
            }, 1000);
          })
        } else {
          setTimeout(function(){
            play_fart(h, play_now, uri);
          }, 1000);
        }
  });
}