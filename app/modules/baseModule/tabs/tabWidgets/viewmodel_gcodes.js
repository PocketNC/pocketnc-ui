define(function(require) {

    var template = require('text!./view_gcodes.html');
    var nls = require('i18n!./nls/resources');

	var ViewModel = function(moduleContext) {

		var self = this;
		self.Panel = null;
		self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;

		self.serverUpdate = false;
                self.gcodes = ko.observable("gcodes test");
                self.mcodes = ko.observable("mcodes test");
                self.feed_rate = ko.observable("feed_rate test");
                self.spindle_rate = ko.observable("spindle_rate test");

                this.setGCodes = function(gcodes) {
                    gcodes.sort(function(a,b) {
                        return a-b;
                    });
                    var newGCodes = "";
                    for(var i = 0; i < gcodes.length; i++) {
                        if(gcodes[i] > 0) {
                            newGCodes += "G" + (gcodes[i]/10) + " ";
                        }
		    }
                    this.gcodes(newGCodes);
                };

                this.setMCodes = function(mcodes) {
                    mcodes.sort(function(a,b) {
                        return a-b;
                    });
                    var newMCodes = "";
                    for(var i = 0; i < mcodes.length; i++) {
                        if(mcodes[i] > 0) {
                            newMCodes += "M" + (mcodes[i]) + " ";
                        }
		    }
                    this.mcodes(newMCodes);
                };

                this.setSettings = function(settings) {
                    this.feed_rate("F" + settings[1]);
                    this.spindle_rate("S" + settings[2]);
                };

		this.getTemplate = function()
		{
		    return template;
		};
		this.getNls = function()
		{
		    return nls;
		};

		this.initialize = function( Panel ) {
		    if (self.Panel == null)
		    {
			self.Panel = Panel;

			self.linuxCNCServer.vars.gcodes.data.subscribe( function(newVal) {
                            self.setGCodes(newVal);
			});
                        this.setGCodes(self.linuxCNCServer.vars.gcodes.data());

			self.linuxCNCServer.vars.mcodes.data.subscribe( function(newVal) {
                            self.setMCodes(newVal);
			});
                        this.setMCodes(self.linuxCNCServer.vars.mcodes.data());

			self.linuxCNCServer.vars.settings.data.subscribe( function(newVal) {
                            self.setSettings(newVal);
			});
                        this.setSettings(self.linuxCNCServer.vars.settings.data());
		    }
		};
	};

	return ViewModel;
});
