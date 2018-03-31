        /// <reference path="https://code.jquery.com/jquery-2.1.4.js" />
        var imgImageHolder = new Image();
        var binBinaryFileHolder;

        /**
         * Handles when a file is selected by the user.
         * Displays the file info.
         */
        function handleFileSelected(e) {
            init();
            //console.log(e.target.files);
            var singleFile = e.target.files[0];
            var url = URL.createObjectURL(singleFile);

            imgImageHolder = null;
            binBinaryFileHolder = null;

            // display the file info
            $('#fiName').text(singleFile.name);
            $('#fiSize').text(singleFile.size + ' byte(s)');
            $('#fiType').text(singleFile.type || (singleFile.name.substr(singleFile.name.lastIndexOf('.'))));
            $('#fiLastModifiedDate').text(singleFile.lastModifiedDate);
            // show the conversion options fieldset
            $('#fsConversionOptions').show();
            $('#btnConvert').show();

            if (isImage(singleFile.type)) {
                console.log('file is an image');
                // if this is an image, show the apropriate stuff
                $('.fileIsImage').show();
                // along with the preview image
                imgImageHolder = new Image();
                imgImageHolder.src = url;
                imgImageHolder.onload = function () {
                    //URL.revokeObjectURL(this.src);
                    var imgPreview = imgImageHolder.cloneNode(true);
                    imgPreview.id = 'imgPreview';
                    imgPreview.alt = 'Preview of ' + singleFile.name;
                    $('#imgPreview').remove();
                    $('#divPreview').append(imgPreview);
                    $('#fiSize').text($('#fiSize').text() + ' (' + imgImageHolder.width + 'x' + imgImageHolder.height + 'px)');
                }
            }
            else {
                console.log('file is binary');
            }
            // load the file as binary too
            var reader = new FileReader();
            reader.onload = function (e) {
                binBinaryFileHolder = e.target.result;
            }
            reader.readAsArrayBuffer(singleFile);
        }

        /**
         * Decides based on the mime type whether the current file is an image or not
         */
        function isImage(mimeType) {
            var imageType = /^image\//;
            return imageType.test(mimeType);
        }

        function convert() {
            $('#divResult').empty();
            $('#fsResult').show();
            $('#txtResult').val('');
            var forceBinary = $('#cbForceBinary').is(':checked');

            // TODO display a loading icon

            var colNum = 16;
            var byteArray = new Array();
            if (imgImageHolder && !forceBinary) {
                var imageWidth = imgImageHolder.width;
                var imageHeight = imgImageHolder.height;
                // handle the resize of the image
                var txtResizeX = $('#txtResizeX').val();
                var txtResizeY = $('#txtResizeY').val();
                if (txtResizeX && txtResizeY) {
                    imageWidth = txtResizeX;
                    imageHeight = txtResizeY;
                }
                else if (txtResizeX && !txtResizeY){
                    imageHeight = Math.floor(imageHeight * (txtResizeX / imageWidth));
                    imageWidth = txtResizeX;
                }
                else if (!txtResizeX && txtResizeY){
                    imageWidth = Math.floor(imageWidth * (txtResizeY / imageHeight));
                    imageHeight = txtResizeY;
                }
                // TODO put the prepareImage into a worker thread https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
                var preparedImageData = prepareImage(imgImageHolder, imageWidth, imageHeight);
                byteArray = preparedImageData.moddedPixels;
                // display the converted image
                // create the canvas for it
                var canvas = $('<canvas />')[0];
                canvas.width = imageWidth;
                canvas.height = imageHeight;
                // get the context from the canvas
                var context = canvas.getContext('2d');
                //console.log('' + imgImageHolder.width + 'x' + imgImageHolder.height);
                // create a new imagedata and put it on the context
                var imgData = new ImageData(preparedImageData.newPixels, imageWidth, imageHeight);
                context.putImageData(imgData, 0, 0);
                // create a new image tag
                var newImage = new Image();
                newImage.src = canvas.toDataURL();
                // add it to the result div
                $('#divResult').append(newImage);
                colNum = imageWidth;
            }
            else if (binBinaryFileHolder) {
                byteArray = prepareBinary(binBinaryFileHolder);
            }
            var stringData = convertToString(byteArray, colNum);
            //console.log('Result: ' + stringData);
            // display the string array
            $('#txtResult').val(stringData);
            $('#txtResult').prop('scrollTop', 0);
            // TODO remove the loading icon
        }


        /**
         * Converts the image to the specified format, and returns the modified pixels in the new format along with them in 24bit format
         */
        function prepareImage(image, newWidth, newHeight) {
            var dtStart = new Date();

            console.log('image size: ' + image.width + 'x' + image.height + ' => ' + newWidth + 'x' + newHeight);
            var paletteMod = $('#cbPaletteMod').val();
            var bytePerPixel = Math.ceil(parseInt(paletteMod) / 8);
            console.log('paletteMod: ' + paletteMod + ' (' + bytePerPixel + 'bytes/pixel)');

            var imageWidth = newWidth;
            var imageHeight = newHeight;

            // create a canvas for the image
            var canvas = $('<canvas />')[0];
            canvas.width = imageWidth;
            canvas.height = imageHeight;
            var context = canvas.getContext('2d');
            // set smoothing for resize
            if (newWidth != image.width) {
                context.mozImageSmoothingEnabled = true;
                context.imageSmoothingQuality = "medium";
                context.webkitImageSmoothingEnabled = true;
                context.msImageSmoothingEnabled = true;
                context.imageSmoothingEnabled = true;                    
            }
           
            // load the image into the context
            context.drawImage(image, 0, 0, imageWidth, imageHeight);

            // get the pixels
            var origPixels = context.getImageData(0, 0, imageWidth, imageHeight).data; // Uint8ClampedArray

            //var isSingleArray = $('[type="radio"][name="cbArrayType"]:checked').val() == 'SINGLE';

            // do image convert
            var convertResult = imageConverter.convert(imageWidth, imageHeight, bytePerPixel, paletteMod, origPixels);
            var moddedPixels = convertResult.moddedPixels;
            var newPixels = convertResult.newPixels;

            console.log('duration: ' + ((new Date()) - dtStart) + 'ms');
            console.log('moddedPixels size: ' + moddedPixels.byteLength + 'bytes')
            console.log('newPixels size: ' + newPixels.byteLength + 'bytes')
            return { moddedPixels: moddedPixels, newPixels: newPixels };
        }

        function prepareBinary(data) {
            var ia = new Uint8Array(data);

            return ia;
        }

        function convertByte(oneByte, conversionType) {
            var stringByte = '???';
            switch (conversionType) {
                case 'HEX0':
                    stringByte = '0x' + ('00' + oneByte.toString(16)).slice(-2);
                    break;
                case 'HEX_SLASH':
                    stringByte = '\\x' + ('00' + oneByte.toString(16)).slice(-2);
                    break;
                case 'DEC':
                    stringByte = oneByte;
                    break;
                case 'BIN':
                    stringByte = 'B' + ('00000000' + (oneByte >>> 0).toString(2)).slice(-8)
                    break;
                default:
            }

            return stringByte;
        }

        function convertToString(data, colNum) {
            console.log('Converting data to string');
            var resultString = '';
            var conversionType = $('#selFormat').val();
            var paletteMod = $('#cbPaletteMod').val();
            var dataLength = (paletteMod == '1') ? Math.ceil(data.byteLength / 8) : data.byteLength;
            console.log('data.byteLength: ' + data.byteLength);
            console.log('dataLength: ' + dataLength);
            var colNumber = (paletteMod == '1') ? Math.ceil(colNum / 8) : colNum;
            console.log('colNum: ' + colNum);
            console.log('colNumber: ' + colNumber);
            var multiLine = $('#cbMultiLine').is(':checked');
            for (var i = 0; i < dataLength; i++) {
                var stringByte = '';
                //if (isArray(data[i])) {
                //    for (var j = 0; j < data[i].length; j++) {
                //        stringByte += convertByte(data[i][j], conversionType) + ', ';
                //    }
                //    if (multiLine) {
                //        stringByte += '\r\n';
                //    }
                //}
                //else {
                //    stringByte = convertByte(data[i], conversionType) + ', ';
                //}
                stringByte = convertByte(data[i], conversionType) + ', ';
                if (multiLine && ((i + 1) % colNumber == 0)) {
                    stringByte += '\r\n';
                }


                resultString += stringByte;
            }

            return resultString.substr(0, resultString.lastIndexOf(',')).trim();
        }

        function copyToClipboard() {
            var txtResult = document.querySelector('#txtResult');
            txtResult.select();

            try {
                var execResult = document.execCommand('copy');
                var msg = execResult ? 'successful' : 'unsuccessful';
                console.log('Copying text command was ' + msg);
            } catch (err) {
                console.log('Oops, unable to copy');
            }
        }

        function saveImage() {
            // TODO do save image
        }

        function init() {
            $('.fileIsImage').hide();
            $('#fsConversionOptions').hide();
            $('#btnConvert').hide();
            $('#fsResult').hide();
            $('#imgPreview').remove();
            $('#fiName').text('');
            $('#fiSize').text('');
            $('#fiType').text('');
            $('#fiLastModifiedDate').text('');
            imgImageHolder = new Image();
            binBinaryFileHolder = null;
        }

        $('document').ready(function () {
            // init
            $('#inFileInput').on('change', handleFileSelected);
            $('#cbForceBinary').on('change', function (e) {
                $('.imageConversionOption').each(function () {
                    $(this).prop('disabled', $('#cbForceBinary').is(':checked'));
                })
                //$('#divForceBinary').prop('disabled', false);
            });
            $('#btnConvert').on('click', convert);
            $('#btnCopyToClipboard').on('click', copyToClipboard);
            $('#btnSaveImage').on('click', saveImage);
            init();
        });
