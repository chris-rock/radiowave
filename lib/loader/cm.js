'use strict';

var logger = require('../core/Logger')('zrocketd'),
  radiowave = require('../'),
  Promise = require('bluebird'),
  pem = require('pem'),
  nodexmppserver = require('node-xmpp-server');

function ConnectionManager() {}

ConnectionManager.prototype.loadCert = function () {
  return new Promise(function (resolve, reject) {
    pem.createCertificate({
      days: 1,
      selfSigned: true,
      organization: 'node-xmpp team',
      organizationUnit: 'development',
      commonName: 'node-xmpp.org'

    }, function (err, keys) {
      if (err) {
        reject(err);
      } else {
        resolve(keys);
      }
    });
  });
};

ConnectionManager.prototype.tcp = function (domain, keys, settings) {
  // C2S Server with TLS encryption
  var cs2 = null;
  var tls = null;
  tls = {
    key: keys.serviceKey + '\n',
    cert: keys.certificate + '\n'
  };
  tls.ca = tls.cert;

  cs2 = new radiowave.Net.C2SServer({
    'port': settings.port,
    'domain': domain,
    'requestCert': true,
    'rejectUnauthorized': false,
    'tls': tls
  });

  return cs2;
};

ConnectionManager.prototype.bosh = function (domain, keys, settings, multiport, subpath) { // jshint ignore:line
  var boshSettings = null;
  var multiportActive = false;
  if (multiport && ((settings.port === multiport.port) || (!settings.port))) {
    boshSettings = {
      autostart: false
    };
    logger.debug('use multiport for bosh');
    multiportActive = true;
  } else if (settings.port) {
    boshSettings = {
      'port': settings.port
    };
  } else {
    logger.error('could not determine a port for socketio');
  }

  // BOSH Server
  var bosh = new radiowave.Net.BOSHServer(boshSettings);

  if (multiportActive) {
    var app = multiport.app;

    // start bosh service
    app.post('/' + settings.path, function (req, res) {
      bosh.bosh.handleHTTP(req, res);
    });

    app.post('/' + settings.path + '/*', function (req, res) {
      bosh.bosh.handleHTTP(req, res);
    });
  }

  return bosh;
};

ConnectionManager.prototype.websocket = function (domain, keys, settings) {
  // Websocket Server
  var ws = new radiowave.Net.WsServer({
    'port': settings.port,
    'domain': domain,
    'autostart': false
  });
  return ws;
};

ConnectionManager.prototype.engineio = function (domain, keys, settings, multiport, subpath) {
  // Engine IO Server
  var eioSetttings = {
    'domain': domain,
    'autostart': false,
    'subpath': subpath
  };

  if (multiport && ((settings.port === multiport.port) || (!settings.port))) {
    eioSetttings.server = multiport.server;
    logger.debug('use multiport for engine.io');
  } else if (settings.port) {
    eioSetttings.port = settings.port;
  } else {
    logger.error('could not determine a port for engine.io');
  }

  // Engine.io Server
  var eio = new radiowave.Net.EioServer(eioSetttings);

  return eio;
};

ConnectionManager.prototype.socketio = function (domain, keys, settings, multiport) {
  var sioSettings = {
    'domain': domain,
    'autostart': false
  };

  if (multiport && ((settings.port === multiport.port) || (!settings.port))) {
    sioSettings.server = multiport.server;
    logger.debug('use multiport for socket.io');
  } else if (settings.port) {
    sioSettings.port = settings.port;
  } else {
    logger.error('could not determine a port for socket.io');
  }

  // Socket.io Server
  var sio = new radiowave.Net.SioServer(sioSettings);
  return sio;
};

ConnectionManager.prototype.load = function (connectionRouter, settings) {
  var self = this;
  return new Promise(function (resolve, reject) {

    var domain = settings.get('domain');
    var subpath = settings.get('subpath') || '';
    // load settings for connection manager
    var cmsettings = settings.get('connection');
    var multiport = settings.get('multiport');

    if (cmsettings && cmsettings.length > 0) {

      self.loadCert().then(function (keys) {

        cmsettings.forEach(function (item) {

          if (self[item.type]) {
            var cm = self[item.type](domain, keys, item, multiport, subpath);
            if (cm) {
              cm.registerSaslMechanism(nodexmppserver.auth.Plain);
              cm.registerSaslMechanism(nodexmppserver.auth.XOAuth2);
              connectionRouter.addConnectionManager(cm);
            }
          } else {
            logger.warn(item.type + ' is not supported as connection manager');
          }
        });
      });
      resolve();
    } else {
      reject('No connection manager defined');
    }
  });
};
module.exports = ConnectionManager;
