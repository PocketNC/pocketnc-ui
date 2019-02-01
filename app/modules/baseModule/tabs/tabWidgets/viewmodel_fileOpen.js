define(function(require) {

    var template = require('text!./view_fileopen.html');
    var nls = require('i18n!./nls/resources');
    var utils = require('../../../../core/helpers/utility.js');

    var ViewModel = function(moduleContext) {

	var self = this;
        
        self.Panel = null;
        self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;
        
        self.reader = {};
        self.newFile = {};
        self.chunkSize = 200000;
        self.overwrite = false;
        self.isCanceled = false;
        self.timer = {};
        self.isUploading = ko.observable(false);

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
            self.overwrite = false;
            self.isCanceled = false;
            self.isUploading(true);
            var files = evt.target.files; // FileList object
            self.reader = new FileReader();
            self.newFile = files[0];
            self.upload();
            
            $('#file_input').val('').siblings().css('color', 'grey');
            var hoverText = self.newFile.name + " " + self.humanizeFileSize(self.newFile.size);
            document.getElementById("upload").setAttribute("title", hoverText);
            self.updateProgress(0);
            self.toggleUploadDiv(true);
            self.timer = setInterval(function() { self.connectionCheck() }, 3000);
        }
        
        this.connectionCheck = function() {
            if( !self.linuxCNCServer.server_logged_in() ){
                $.pnotify({title: "Alert", text: 'Connection to server lost', type: "Alert"});
                self.cancelUpload();
            }
        }

        this.upload = function(startIdx=0)
        {
            var nextIdx = startIdx + self.chunkSize + 1;
            var blob = self.newFile.slice( startIdx, nextIdx );

            self.reader.onload = function(e) {
                
                function listenMsg(event){
                    if(self.isCanceled){
                        self.linuxCNCServer.socket.removeEventListener('message', listenMsg);
                        return;
                    }

                    var msg = JSON.parse(event.data);
                    if(msg.id === "program_upload_chunk"){
                        self.isConnected = true;
                        if(msg.code === "?OK"){
                            
                            self.linuxCNCServer.socket.removeEventListener('message', listenMsg);
                             
                            if(msg.data === "occupied"){
                                self.overwrite = true;
                                $('#fileOverwriteFile').html(self.newFile.name);
                                $('#fileOverwriteModal').modal('show'); 
                                return;
                            }

                            self.updateProgress(nextIdx / self.newFile.size); 
                            if(nextIdx < self.newFile.size){
                                isLastChunk = (nextIdx + self.chunkSize) > self.newFile.size;
                                if( isLastChunk ){
                                    self.linuxCNCServer.setRmtMode(self.linuxCNCServer.TASK_MODE_MDI);
                                    self.linuxCNCServer.setRmtMode(self.linuxCNCServer.TASK_MODE_AUTO);
                                }
                                self.upload(nextIdx);
                            }
                            else{
                                var newStatus = '';
                                if(self.overwrite)
                                    newStatus = 'Succesfully overwrote file ' + self.newFile.name;
                                else
                                    newStatus = 'Succesfully uploaded ' + self.newFile.name;
                                $.pnotify({title: "Success", text: newStatus, type: "success"});
                                
                                setTimeout(function() { 
                                    self.toggleUploadDiv(false) 
                                    $('#file_input').removeAttr('disabled').siblings().css({ 'color': 'black'});
                                }, 1000);

                                clearInterval(self.timer);
                                //force a refresh of knockout observable in case the uploaded file has the same name as the one currently open
                                //filePanel.ViewModel.requestFileContent();
                                lcncsvr.vars.file.data.valueHasMutated();
                                self.isUploading(false);
                            }
                        }
                        else if(msg.code === "?Error executing command"){
                            var newStatus = 'Error uploading file ' + self.newFile.name;
                            $.pnotify({title: "Error", text: newStatus, type: "error"});
                            self.cancelUpload();
                            self.isCanceled = true;
                            $('#file_input').removeAttr('disabled').siblings().css({ 'color': 'black'});
                        }
                    }
                }

                
                self.linuxCNCServer.socket.addEventListener('message', listenMsg);
                var start = (startIdx === 0);
                var end = (nextIdx > self.newFile.size);
                self.linuxCNCServer.uploadChunkGCode(self.newFile.name, e.target.result, start, end, self.overwrite);
            };
            
            self.reader.readAsText(blob);
        }
        
        this.toggleUploadDiv = function(isTurningOn){
            var e = document.getElementById("upload");
            if(e !== null){
                if(isTurningOn){
                    e.style.display = "flex";
                } else {
                    e.style.display = "none";
                }
            }
        }
       
        this.cancelUpload = function(){
            self.isCanceled = true;
            self.isUploading(false);
            var text = 'Canceled upload of ' + self.newFile.name;
            $.pnotify({title: "Upload canceled", text: text, type: "info"});
            clearInterval(self.timer);
            setTimeout(function() { 
                self.toggleUploadDiv(false) 
                $('#file_input').removeAttr('disabled').siblings().css({ 'color': 'black'});
            }, 1000);
        }

        this.humanizeFileSize = function(size) {
            var i = size == 0 ? 0 : Math.floor( Math.log(size) / Math.log(1000) );
            return ( size / Math.pow(1000, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
        }
        
        this.updateProgress = function(proportion){
            var bar = $('#upload-bar');
            percent = Math.min((proportion * 100).toFixed(1), 100);
            percent = percent + '%';
            bar.width(percent);
            $('#upload-bar-text').html(percent);
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
