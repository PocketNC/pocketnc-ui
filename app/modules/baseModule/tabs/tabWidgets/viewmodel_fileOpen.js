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
        var chunkSize = 2000000;
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
            overwrite = false;
            var files = evt.target.files; // FileList object
            reader = new FileReader();
            newFile = files[0];
            
            //If a file of the same name is already present, delete it
            //self.linuxCNCServer.deleteFile(newFile.name);

            start = Date.now();
            now = start;
            self.upload();
            $('#file_input').val(""); // clear file_input so same file can be reuploaded.
        }
var prev = 0, now = 0, start;
        this.upload = function(startIdx=0)
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
                                 
                                if(msg.data === "occupied"){
                                    overwrite = true;
                                    $('#fileOverwriteFile').html(newFile.name);
                                    $('#fileOverwriteModal').modal('show'); 
                                    return;
                                }

                                self.showProgress(nextIdx / newFile.size); 
                                if(nextIdx < newFile.size){
                                    self.upload(nextIdx);
                                }
                                else{
                                    //self.download(newFile.name);
                                    self.linuxCNCServer.requestFileContent();
                                }
                            }
                            else if(msg.code === "?Error executing command"){
                                window.alert("Error uploading file");
                            }
                        }
                    }
                    
                    self.linuxCNCServer.socket.addEventListener('message', listenMsg);
                    var start = startIdx === 0;
                    var end = nextIdx > newFile.size;
                    self.linuxCNCServer.uploadChunkGCode(newFile.name, e.target.result, start, end, overwrite);
                }
            })(blob);
            
            reader.readAsText(blob);
        }

        this.showProgress = function(proportion){
            var bar = $('#uploadProgressBar');
            percent = Math.min((proportion * 100).toFixed(1), 100);
            percent = percent + '%';
            bar.width(percent);
            bar.html(percent); 
        }

        this.download = function(filename){
            function listenMsg(event){
            var msg = JSON.parse(event.data);
                  if(msg.id === "program_download_chunk"){
                  console.log(msg);
                  if(msg.code === "?OK"){
                    
                    self.linuxCNCServer.socket.removeEventListener('message', listenMsg);
                     
                  }
                  else if(msg.code === "?Error executing command"){
                    window.alert("Error uploading file");
                  }
                  }
                  }
            var sizeRead = 0, fileSize = chunkSize;
            self.linuxCNCServer.socket.addEventListener('message', listenMsg);
            do{
                var ret = self.linuxCNCServer.requestFileContent();
                sizeRead += chunkSize;
            } while (sizeRead < fileSize)     
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
