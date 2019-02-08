define(function(require) {

    var template = require('text!./view_workOffsets.html');
    var nls = require('i18n!./nls/resources.js');
    var utils = require('../../../../core/helpers/utility.js');

	var ViewModel = function(moduleContext) {

		var self = this;
        self.Panel = null;
        self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;
        self.settings = moduleContext.getSettings();
        
        // we use unique IDs in the view, so increment the counter so the next instance of t his view model will get a new ID
        // The modal dialogs need unique IDs globally, so each instance of this view must have different IDs for the modals
        self.nextUniqueElementID = ko.observable(Date.now());

        this.getTemplate = function()
        {
            return template;
        }
        this.getNls = function()
        {
            return nls;
        }


        this.initialize = function( Panel ) {
            if (self.Panel == null)
            {
                self.Panel = Panel;
            }
            
            $(document).keydown(function(e){
                if(e.keyCode == 13 || e.keyCode == 27){
                    var modalStr = "";
                    if($("#SelectToolModal" + self.nextUniqueElementID()).hasClass("in")){
                        modalStr = "SetTool";
                        self.tempToolNumber($("#inputToolSet").val());
                    }
                    else if($("#SelectOffsetG5xModal" + self.nextUniqueElementID()).hasClass("in")){
                        modalStr = "SetG5x"
                        self.tempOffset($("#inputOffsetG5xSet").val());
                    }
                    else if($("#SelectOffsetG92Modal" + self.nextUniqueElementID()).hasClass("in")){
                        modalStr = "SetG92"
                        self.tempOffset($("#inputOffsetG92Set").val());
                    }
                    
                    if(modalStr !== ""){
                        e.preventDefault();
                        if(e.keyCode == 13){
                            $("#save" + modalStr).click();
                        }
                        else{
                            $("#cancel" + modalStr).click();
                        }
                    }
                }
            });
	};


        self.tempToolNumber = ko.observable(self.linuxCNCServer.vars.tool_in_spindle.data());
        self.linuxCNCServer.vars.tool_in_spindle.data.subscribe(function(newval){self.tempToolNumber(newval);});

        self.tempOffset = ko.observable(0);
        self.curIdx = ko.observable(0);


        this.G54ZeroDRO = function(data,event,index){
            alert("Zero G54 " + index );
        };
        this.G54SetDRO = function(data,event,index){
            alert("G54SetDRO " + index );
        };
        this.G54SetDROToRadius = function(data,event,index){
            alert("G54SetDROToRadius " + index );
        };
        this.G54Clear = function(data,event,index){
            alert("G54Clear " + index );
        };
        this.G54ClearAll = function(){
            alert("G54ClearAll");
        };

        return self;

	};

	return ViewModel;
});
