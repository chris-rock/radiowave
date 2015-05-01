'use strict';

var logger = require('../core/Logger')('radiowave'),
  Promise = require('bluebird'),
  radiowave = require('../');

function XepModules() {}

// core
XepModules.prototype.Core = function (domain, storage, settings) {
  return new radiowave.Components.Core({
    'domain': domain,
    'storage': storage,
    'modules': settings.modules
  });
};

// muc
XepModules.prototype.Xep0045 = function (domain, storage, settings) {
  return new radiowave.Components.Xep0045({
    'subdomain': settings.subdomain,
    'domain': domain,
    'storage': storage
  });
};

// pubsub
XepModules.prototype.Xep0060 = function (domain, storage, settings) {
  return new radiowave.Components.Xep0060({
    'subdomain': settings.subdomain,
    'domain': domain,
    'storage': storage
  });
};

XepModules.prototype.load = function (settings, storage) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var components = settings.get('components');
    var domain = settings.get('domain');

    logger.debug('Configure domain: ' + domain);
    var cr = new radiowave.Router.ComponentRouter({
      'domain': 'example.net'
    });

    if (components) {
      components.forEach(function (module) {
        try {
          logger.info('load components ' + module.type);
          if (self[module.type]) {
            var m = self[module.type](domain, storage, module);
            cr.addComponent(m);
          } else {
            logger.warn('component ' + module.type + ' is not known.');
          }
        } catch (err) {
          logger.error('error during load of component: ' + err);
        }
      });
      resolve(cr);
    } else {
      reject('no defined components found');
    }
  });
};

module.exports = XepModules;