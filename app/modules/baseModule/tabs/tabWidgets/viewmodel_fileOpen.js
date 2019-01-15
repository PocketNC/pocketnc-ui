define(function(require) {

    var template = require('text!./view_fileopen.html');
    var nls = require('i18n!./nls/resources');
    var utils = require('../../../../core/helpers/utility.js');

	var ViewModel = function(moduleContext) {

		var self = this;
        self.Panel = null;
        self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;

        var reader = {};
        var newFile = {};
        var chunkSize = 300000;

        this.getTemplate = function()
        {
            return template;
        }
        this.getNls = function()
        {
            return nls;
        }

        this.deleteFile = function(file) {
            self.linuxCNCServer.deleteFile(file);
            if(self.linuxCNCServer.filename_nopath() === file) {
                self.linuxCNCServer.vars.file.data("");
                self.linuxCNCServer.vars.backplot_async.data("");
                self.linuxCNCServer.vars.file_content.data("");
            }
        }


        this.readFile = function(reader)
        {

        }

        this.testFileSelect = function( evt )
        {
            var files = evt.target.files; // FileList object
            reader = new FileReader();
            newFile = files[0];
            
            //If a file of the same name is already present, delete it
            self.linuxCNCServer.deleteFile(newFile.name);

            var chunkStart = 0;
            self.upload(chunkStart);
            $('#file_input').val(""); // clear file_input so same file can be reuploaded.
        }

        this.upload = function(startIdx)
        {
            var nextIdx = startIdx + chunkSize + 1;
            var blob = newFile.slice( startIdx, nextIdx );
       
            reader.onload = (function(theChunk) {
                return function(e) {
                    self.linuxCNCServer.uploadGCode(newFile.name, e.target.result );
                    
                    self.linuxCNCServer.socket.onmessage = function(event) {
                        console.log("other msg");
                        var msg = JSON.parse(event.data);
                        if(msg.id === "program_upload"){
                            console.log(msg);
                            if(msg.code === "?OK"){
                                if(nextIdx < newFile.size){
                                    console.log("File upload progress: " + (nextIdx / newFile.size) * 100);
                                    self.upload(nextIdx);
                                }
                                else{
                                    console.log("done");
                                    self.linuxCNCServer.requestFileContent();
                                }
                            }
                        }
                    }
                };
            })(blob);
            reader.readAsText(blob);

       }

	this.initialize = function( Panel ) {
            if (self.Panel == null)
            {
                self.Panel = Panel;
                $('.switch', self.Panel.getJQueryElement()).bootstrapSwitch();

                $('#file_input', self.Panel.getJQueryElement()).bind('change', self.testFileSelect );
            }
	};




	};

	return ViewModel;
});
