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
        var chunkSize = 100000;
        var overwrite = false;

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
            start = Date.now();
            now = start;
            self.upload(chunkStart);
            $('#file_input').val(""); // clear file_input so same file can be reuploaded.
        }
var prev = 0, now = 0, start;
        this.upload = function(startIdx)
        {
            var nextIdx = startIdx + chunkSize + 1;
            var blob = newFile.slice( startIdx, nextIdx );
       
            reader.onload = (function(theChunk) {
                
                return function(e) {
                    
                    function listenMsg(event){
                        var msg = JSON.parse(event.data);
                        if(msg.id === "program_upload_chunk"){
                            console.log(msg);
                            if(msg.code === "?OK"){
                                self.linuxCNCServer.socket.removeEventListener('message', listenMsg);
                                if(nextIdx < newFile.size){
                                    prev = now;
                                    now = Date.now();
                                    console.log(now - prev);
                                    console.log("File upload progress: " + (nextIdx / newFile.size) * 100);
                                    self.upload(nextIdx);
                                }
                                else{
                                    console.log("done");
                                    console.log(Date.now() - start);
                                }
                            }
                        }
                    }
                    
                    self.linuxCNCServer.socket.addEventListener('message', listenMsg);
                    var flag = (nextIdx > newFile.size) ? 1 : 0;
                    self.linuxCNCServer.uploadChunkGCode(newFile.name, e.target.result, flag);
                }
            })(blob);
            
            reader.readAsText(blob);
        }

        this.finishUpload = function() {
            function listenFinishMsg(e) {
                var msg = JSON.parse(e.data);
                if(msg.id === "program_upload_finish"){
                    console.log(msg);
                    if(msg.code === "?OK"){
                        if(msg.data === "filename_in_use")
                            console.log("confirm file replacement");
                        else    
                            self.linuxCNCServer.requestFileContent();
                    }
                }
            }
            self.linuxCNCServer.socket.addEventListener('message', listenFinishMsg);
            self.linuxCNCServer.finishUploadGCode(newFile.name);
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
