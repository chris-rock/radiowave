'use strict';

var util = require('util'),
    XModule = require('../../../core/XModule'),
    ltx = require('ltx'),
    XmppPresence = require('node-xmpp-core').Stanza.Presence,
    JID = require('node-xmpp-core').JID,
    NS = require('../namespace'),
    mucutil = require('../Util');

function Presence(storage, options) {
    XModule.call(this);
    this.logger = require('../../../core/Logger')('xep-0045:presence');
    
    // storage
    this.storage = storage;

    // muc options
    this.options = options;
}

util.inherits(Presence, XModule);

Presence.prototype.name = 'XEP-0045: Presence';

Presence.prototype.match = function (stanza) {
    // presence
    return (stanza.is('presence'));
};

Presence.prototype.generatePresence = function (affiliation, role) {
    var presence = new XmppPresence({
        from: '',
        to: ''
    });
    presence.c('x', {
        'xmlns': NS.MUC_USER
    }).c('item', {
        'affiliation': affiliation,
        'role': role
    });

    return presence;
};

Presence.prototype.sendPresenceConfirmation = function (room, member, roomjid) {
    this.logger.debug('send presence confirmation to ' + member.jid);

    // send client the confirmation
    var confirmMsg = new XmppPresence({
        from: roomjid.toString(),
        to: member.jid.toString()
    });
    var x = confirmMsg.c('x', {
        'xmlns': NS.MUC_USER
    });
    x.c('item', {
        'affiliation': member.RoomMembers.affiliation,
        'role': member.RoomMembers.role
    });
    x.c('status', {
        'code': '110'
    });
    this.send(confirmMsg);
};

Presence.prototype.sendPresenceJoin = function (room, newMember, roomjid, nickname) {
    this.logger.debug('send join of ' + newMember.jid + ' to all participants');
    var self = this;

    // iterate over existing members
    room.getMembers().success(
        function (members) {
            try {
                // send presence to each member
                var newPresence = self.generatePresence(NS.MUC_AFFILIATION_ADMIN, NS.MUC_ROLE_ADMIN);
                for (var i = 0, l = members.length; i < l; i++) {
                    var member = members[i];

                    // send existing room members the info about new user
                    if (member.jid.toString() !== newMember.jid.toString()) {
                        var memberMessage = newPresence.clone();
                        var newuser = roomjid.bare();
                        newuser.setResource(nickname);
                        memberMessage.attrs.from = newuser.toString(); // must be with nickname of user
                        memberMessage.attrs.to = member.jid;
                        self.send(memberMessage);
                    }

                    // send presence of existing room members to new user
                    if (member.jid.toString() !== newMember.jid.toString()) {
                        // read member details
                        var nick = member.RoomMembers.nickname;
                        var affiliation = member.RoomMembers.affiliation;
                        var role = member.RoomMembers.role;

                        var joinermsg = self.generatePresence(affiliation, role);

                        var memberroomjid = roomjid.bare();
                        memberroomjid.setResource(nick);

                        joinermsg.attrs.from = memberroomjid.toString();
                        joinermsg.attrs.to = member.jid.toString();
                        self.send(joinermsg, null);
                    }
                }
            } catch (err) {
                self.logger.error(err.toString());
            }
        }
    );
};

Presence.prototype.sendRoomHistory = function (room, member, roomjid ) {
    this.logger.debug('send room ' + roomjid + ' history to ' + member.jid);
    var self = this;
    room.getMessages().success(
        function (messages) {
            // send room history
            for (var i = 0, l = messages.length; i < l; i += 1) {
                // extract message
                var el = ltx.parse(messages[i].content);
                // el.attrs.from = roomjid;
                el.attrs.to = member.jid;
                self.send(el);
            }
        }
    ).error(function(err){
        self.logger.error(err);
    });
};

Presence.prototype.joinRoom = function (room, user, roomjid) {
    var nickname = roomjid.resource.toString();
    var self = this;

    this.logger.debug('user ' + user.jid + ' joins the room');

    // join room
    room.join(user, {
        role: 'visitor',
        affiliation:'member',
        nickname: nickname
    }).then(function (member) {

        // send presence confirmation to new member
        self.sendPresenceConfirmation(room, member, roomjid);

        // send presence of existing users to new member and 
        // inform the existing members about the new member
        self.sendPresenceJoin(room, member, roomjid, nickname);

        // send the new member the message history
        self.sendRoomHistory(room, member, roomjid);
    });

};


Presence.prototype.sendPresenceLeave = function (room, user, roomjid) {
    var self = this;

    // send client the confirmation
    var confirmMsg = new XmppPresence({
        from: roomjid,
        to: user.jid,
        type: 'unavailable'
    });
    var x = confirmMsg.c('x', {
        'xmlns': NS.MUC_USER
    });
    x.c('item', {
        'affiliation': NS.MUC_AFFILIATION_ADMIN,
        'role': NS.MUC_ROLE_ADMIN
    });
    x.c('status', {
        'code': '110'
    });
    self.send(confirmMsg);

    // send new presense to exsting members
    var newPresence = new XmppPresence({
        from: '',
        to: '',
        type: 'unavailable'
    });
    newPresence.c('x', {
        'xmlns': NS.MUC_USER
    }).c('item', {
        'affiliation': NS.MUC_AFFILIATION_ADMIN,
        'role': NS.MUC_ROLE_ADMIN
    });

    room.getMembers().then(
        function (members) {
            for (var i = 0, l = members.length; i < l; i += 1) {
                var member = members[i];

                // send existing room members the info
                var memberMessage = newPresence.clone();
                memberMessage.attrs.from = roomjid;
                memberMessage.attrs.to = member.jid;
                self.send(memberMessage);
            }
        }
    );
};

Presence.prototype.leaveRoom = function (room, user, roomjid) {
    var self = this;
    this.logger.debug('user' + user.jid + ' leaves the room');

    // leave room
    room.leave(user).then(
        function () {
            self.logger.debug('send unavailibility to all users');
            self.sendPresenceLeave(room, user, roomjid);
        }).catch(function (err) {
            self.logger.error(err);
        });
};

Presence.prototype.handlePresence = function (room, user, stanza) {
    this.logger.debug('handle presence');
    var self = this;

    var roomjid = new JID(stanza.attrs.to);

    // user leaves the room 
    // @see http://xmpp.org/extensions/xep-0045.html#exit
    if (room && stanza.attrs.type === 'unavailable') {
        self.leaveRoom(room, user, roomjid);
    }
    // user joins the room
    else {
        self.joinRoom(room, user, roomjid);
    }
};

/**
 * @desc Implement Muc 7.2
 * @param stanza full pubsub message stanza
 * @see http://xmpp.org/extensions/xep-0045.html#enter
 */
Presence.prototype.handleOccupantPresence = function (stanza) {
    this.logger.debug('muc handle presence');
    var self = this;

    var roomname = mucutil.determineRoomname(stanza);
    var userjid = stanza.attrs.from;

    var user = null;
    var room = null;

    var storage = this.storage;

    storage.findOrCreateUser(mucutil.getBareJid(userjid)).then(function (u) {
        user = u;

        // find room
        storage.findRoom(roomname)
            .then(function (room) {
                // room exists
                self.handlePresence(room, user, stanza);
            }).
        catch (function (err) {
            if (self.options.RoomAutoCreate) {
                storage.addRoom(user, {
                    name: roomname
                }).then(function (room) {
                    // join the room
                    self.handlePresence(room, user, stanza);
                });
            } else {
                self.logger.error(err);
                // room does not exist
                self.sendError(stanza, mucutil.Error.NotFound);
            }
        });

    }).
    catch (function (err) {
        self.logger.error(err);
        // room does not exist
        self.sendError(stanza, mucutil.Error.NotFound);
    });

    return true;
};

Presence.prototype.handle = function (stanza) {
    var handled = false;
    var to = new JID(stanza.attrs.to);

    if (stanza.is('presence')) {
        // handle presence request for specific room
        if (to.getDomain().toString().localeCompare(this.getDomain) !== 0) {
            handled = this.handleOccupantPresence(stanza);
        }

        // TODO handle normal presence request
        // 1. check if user is already offline
        // 2. make user offline in all active rooms
    }

    return handled;
};

module.exports = Presence;