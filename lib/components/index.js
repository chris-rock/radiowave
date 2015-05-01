'use strict';

/**
 * `Components` are like `Modules` but run on a standalone subdomain.
 * All implementations delivered with Radiowave implement the module interface and
 * are able to run as a seperate XEP-0114: Jabber Component Protocol
 */
module.exports = {
  Core: require('./Core'),
  Xep0045: require('./Xep0045-muc'),
  Xep0060: require('./Xep0060-pubsub')
};