define(function(require) {

    var template = require('text!./view_fileopen.html');
    var nls = require('i18n!./nls/resources');
    var utils = require('/app/core/helpers/utility.js');

	var ViewModel = function(moduleContext) {

		var self = this;
        self.Panel = null;
        self.linuxCNCServer = moduleContext.getSettings().linuxCNCServer;

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
            var reader = new FileReader();
            var f = files[0];
            reader.onload = (function(theFile) {
                return function(e) {
                    self.linuxCNCServer.uploadGCode(theFile.name, e.target.result );
                    self.linuxCNCServer.requestFileContent();

                    $('#file_input').val(""); // clear file_input so same file can be reuploaded.
                };
            })(f);
            reader.readAsText(f);
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
