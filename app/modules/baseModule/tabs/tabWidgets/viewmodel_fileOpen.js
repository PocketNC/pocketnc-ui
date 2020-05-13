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
        self.fileName = ko.observable("");
        self.chunkSize = 200000;
        self.overwrite = false;
        self.isCanceled = false;
        self.timer = {};
        self.isUploading = ko.observable(false);
        self.uploadPercent = ko.observable(0);

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
            self.fileName(self.newFile.name);
            self.upload();
            
            $('#file_input').val('');
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
            }, 1000);
        }

        this.humanizeFileSize = function(size) {
            var i = size == 0 ? 0 : Math.floor( Math.log(size) / Math.log(1000) );
            return ( size / Math.pow(1000, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
        }
      
        this.updateProgress = function(proportion){
            self.uploadPercent(Math.min((proportion * 100).toFixed(1), 100) + '%');
        }


        this.usbDetected = ko.observable(false);
        this.usbMountPath = "";
        this.currentFileBrowserDir = "local-files";

        this.linuxCNCServer.vars.usb_map.data.subscribe(function (data){
          if( data.detected ){
            self.usbDetected(true);
            self.usbMountPath = data.mountPath;
            self.injectUsb(data);
          }
          else
            self.usbDetected(false);
            self.homeFileBrowser();
        });

        this.injectUsb = function(usbData){
          //If there is an existing HTML mapping of the USB drive, delete it
          $('#usb-dirs').remove();
          
          //Create the parent element for the mapping
          var usbDirs = document.createElement('span');
          usbDirs.id = "usb-dirs";
          usbDirs.className = "btn-group";
          usbDirs.style.display = "contents";
          $("#file-browser").append(usbDirs);

          //Begin the mapping. This is a top-down recursive process
          var topLevelDir = usbData.mountPath.slice(usbData.mountPath.lastIndexOf("/") + 1);
          self.injectDir(usbData[topLevelDir], document.getElementById("usb-btn"), usbDirs, "local-files", usbData.mountPath);
          
          //KO data-binds in the dynamic content need to be activated. 
          ko.applyBindings( self, document.getElementById("usb-dirs"));
        };

        //This function is used recursively to generate a set of UL elements, each listing files and sub-dirs of a dir within the USB drive
        this.injectDir = function( usbDirMap, parentBtn, parentElement, upDirId, pathToDir){
          var ul = document.createElement('ul');
          ul.className = "dropdown-menu usb-list";
          ul.role = "menu";
          ul.id = parentBtn.id + "-list";
          ul.setAttribute("style", "display:none");
          parentElement.appendChild(ul);

          // Each directory will be represented by a ul html element, dirIdx is used to generate unique html ids for them
          var dirIdx = -1;
          // Directories without any .ngc files will have a placeholder li element in their ul
          var hasNgcFiles = false;

          for( var item in usbDirMap ){
            var isItemFile = (usbDirMap[item] === null);

            var itemLi = document.createElement('li');

            if( isItemFile ){
              hasNgcFiles = true;
              ul.appendChild(itemLi);
              itemLi.className = "file_hover";

              var a = document.createElement('a');
              a.style.cssText = "display: inline-block; width: 300px; height: 28px";
              a.tabindex = "-1";
              a.text = item;
              itemLi.appendChild(a);

              a.addEventListener("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                self.linuxCNCServer.openFile(pathToDir + "/" + e.currentTarget.text);
                //collapse the top level list once a file has been selected to open
                $(e.target.closest("ul")).toggle();
                //remove "open" from the class list of the primary file selection button
                $("#file-browser").attr("class", "btn-group");
              });
            }
            else { 
              dirIdx++;
              //put all the sub-dir items at the top of the list
              ul.prepend(itemLi);
              itemLi.className = "file_hover sub_dir";
              itemLi.id = ul.id + "-sub-dir-" + dirIdx;
              
              var dataBindStr = "click: enterDir, clickBubble: false";
              itemLi.setAttribute("data-bind", dataBindStr);

              var collapseIcon = document.createElement('i');
              collapseIcon.setAttribute("style", "margin: 5px; display: inline-block");
              collapseIcon.className = "icon-chevron-right";
              itemLi.appendChild(collapseIcon);
              
              var btn = document.createElement('button');
              btn.className = "dropdown dir_btn";
              btn.innerHTML = item + "";
              itemLi.appendChild(btn);

              var folderIcon = document.createElement('i');
              folderIcon.className = "icon-folder-close";
              btn.prepend(folderIcon);

              self.injectDir(usbDirMap[item], itemLi, document.getElementById('usb-dirs'), ul.id, pathToDir + "/"+ item);
            }
          }

          if( ! hasNgcFiles ){
            var noFilesLi = document.createElement('li');
            ul.appendChild(noFilesLi);
            noFilesLi.className = "file_hover";
            var a = document.createElement('a');
            a.style.cssText = "display: inline-block; width: 300px; height: 28px";
            a.tabindex = "-1";
            a.text = "No .ngc files in this directory";
            noFilesLi.appendChild(a);
          }

          var navLi = document.createElement('li');
          navLi.setAttribute("data-bind", "clickBubble: false");
          
          var homeBtn = document.createElement('button');
          homeBtn.className = "icon-home dropdown dir_btn";
          homeBtn.title = "Home";
          homeBtn.setAttribute("style", "width: 32px; display: inline-block");
          homeBtn.setAttribute("data-bind", "click: homeFileBrowser, clickBubble: false")
          navLi.append(homeBtn);

          var upBtn = document.createElement('button');
          upBtn.className = "icon-chevron-up dropdown dir_btn";
          upBtn.title = "Go up one level";
          upBtn.setAttribute("style", "width: 32px; display: inline-block");
          upBtn.setAttribute("data-bind", "click: navUp, clickBubble: false");
          upBtn.setAttribute("data-up-id", upDirId);
          navLi.append(upBtn);

          var locationSpan = document.createElement('span');
          locationSpan.title = "Full path: " + pathToDir;
          locationSpan.setAttribute("style", "width: 300px; height: 28px")
          var locationText = "USB" + pathToDir.slice("/media/usb0".length);
          if(locationText.length > 39)
            locationText = "USB/..." + locationText.substr( locationText.indexOf("/", locationText.length - 36 ) );
          locationSpan.textContent = locationText;
          var openFolderIcon = document.createElement('i');
          openFolderIcon.className = "icon-folder-open";
          locationSpan.prepend(openFolderIcon);
          navLi.append(locationSpan);

          ul.prepend(navLi, ul.firstChild);
        };

        this.enterDir = function(data,event){
          $(event.target.closest("ul")).hide();
          var li = event.target.closest("li");
          var dirId = li.id + "-list";
          this.currentFileBrowserDir = dirId;
          $("#" + dirId).toggle();
        };

        this.navUp = function(data,event){
          var ul = event.target.closest("ul");
          $(ul).hide();
          var upBtn = event.target.closest("button");
          this.currentFileBrowserDir = $(upBtn).attr("data-up-id")
          $("#" + this.currentFileBrowserDir).toggle();
        };

        this.toggleList = function(data,event,show){
          var clickedBtn;
          if(event.target.tagName === "BUTTON")
            clickedBtn = $("#" + event.target.id);
          else if(event.target.tagName === "I")
            clickedBtn = $(event.target).siblings("button");
          else if(["LI", "SPAN"].indexOf(event.target.tagName) > -1)
            clickedBtn = $(event.target).children("button");
          else return;

          dropdownIcon = clickedBtn.prev()[0];
          if(dropdownIcon.className === "icon-chevron-down"){
            dropdownIcon.className = "icon-chevron-right";
          }
          else{
            dropdownIcon.className = "icon-chevron-down";
          }
          self.collapseSiblingLists(clickedBtn);
          clickedBtn.children().toggle();
        };

        this.collapseSiblingLists = function(clickedBtn){
          var listOfLists  = clickedBtn.parent().siblings(".sub_dir")
          var i;
          for(i = 0; i < listOfLists.length; i++){
            listOfLists[i].children[0].className = "icon-chevron-right";
            $(listOfLists[i]).children("button").children("ul").toggle(false);
          }
        };

        this.toggleFileBrowser = function(){
          $("#" + this.currentFileBrowserDir).toggle();
        };

        this.homeFileBrowser = function(){
          var wasOpen = false;
          if( $("#" + this.currentFileBrowserDir).is(':visible') ){
            wasOpen = true;
            $("#" + this.currentFileBrowserDir).hide();
          }
          self.currentFileBrowserDir = "local-files";
          if( wasOpen){
            $("#" + this.currentFileBrowserDir).hide();
            $("#" + this.currentFileBrowserDir).show();
            $("#file-browser").attr("class", "btn-group open");
          }
        };

        this.ejectUsb = function(){
          self.linuxCNCServer.eject_usb();
          self.homeFileBrowser();
        }

        //if user clicks outside the lists, fully close the file browser, including styling of primary button
        $(document).mouseup(function(e){
          var fileBrowser = $("#file-browser");

          if( !fileBrowser.is(e.target) && fileBrowser.has(e.target).length === 0){
            $("#" + self.currentFileBrowserDir).hide();
            $("#file-browser").attr("class", "btn-group");
          }
        });

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
