'use strict';

var ltx = require('ltx'),
  util = require('util'),
  XModule = require('../../../core/XModule'),
  logger = require('../../../core/Logger')('version');

var NS_VERSION = 'jabber:iq:version';

/*
 * XEP-0092: Software Version
 * http://xmpp.org/extensions/xep-0092.html
 */
function Version() {
  XModule.call(this);

  this.name = 'Radiowave';
  this.version = '1.0.0';
  this.os = 'RadioOS';

  logger.info('load ' + this.name);
}
util.inherits(Version, XModule);

Version.prototype.name = 'XEP-0092: Software Version';

Version.prototype.version = '0.1.0';

/**
 * check if this component handles this type of message
 * <iq
 *     type='get'
 *     from='romeo@montague.net/orchard'
 *     to='juliet@capulet.com/balcony'
 *     id='version_1'>
 *   <query xmlns='jabber:iq:version'/>
 * </iq>
 */
Version.prototype.match = function (stanza) {
  if (stanza.is('iq') && stanza.attrs.type === 'get' && (stanza.getChild('query', NS_VERSION))) {
    logger.debug('detected version request');
    return true;
  }
  return false;
};

/**
 * handle message, only applied after match
 * <iq
 *     type='result'
 *     to='romeo@montague.net/orchard'
 *     from='juliet@capulet.com/balcony'
 *     id='version_1'>
 *   <query xmlns='jabber:iq:version'>
 *     <name>Exodus</name>
 *     <version>0.7.0.4</version>
 *     <os>Windows-XP 5.01.2600</os>
 *   </query>
 * </iq>
 */
Version.prototype.handle = function (stanza) {

  var version = new ltx.Element('iq', {
    from: stanza.attrs.to,
    to: stanza.attrs.from,
    id: stanza.attrs.id,
    type: 'result'
  });

  version
    .c('query', {
      xmlns: NS_VERSION
    })
    .c('name').t(this.name).up()
    .c('version').t(this.version).up()
    .c('os').t(this.os);

  logger.debug('send version');
  this.send(version);

  return true;
};

module.exports = Version;
