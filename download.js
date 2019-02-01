var maxWidth = 0;
var jszip = null;
var project = null;
var id = null;
var soundId = 0;
var costumeId = 0;
var soundsToDownload = [];
var costumesToDownload = [];
var totalAssets = 0;
var completeAssets = 0;
var textLayerIDCounter = 100000;

function startDownload(projectId){
    $("#log").text("");
    $("#progress").text("");
    logMessage("Downloading project: "+projectId);
    soundId = 0;
    costumeId = 0;
    totalAssets = 0;
    completeAssets = 0;
    soundsToDownload = [];
    costumesToDownload = [];
    id = projectId;
    setProgress(0);
    jszip = new JSZip();
    jszip.comment = "Created with MegaApuTurkUltra's Project Downloader";
    fetch("https://projects.scratch.mit.edu/" + projectId).then(response => {
        if (response.headers.get('content-type') === 'application/json') {
            return response.text().then(scratchParseJSON).then(gotJSON);
        } else {
            return response.blob().then(blob => {
                return new Promise((resolve, reject) => {
                    setProgress(10);
                    var reader = new FileReader();
                    reader.onerror = reject;
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }).then(content => {
                var text = content.split(',')[1];
                if (atob(text)[0] === '{') {
                    logMessage("Loaded surprise .sb2(?).");
                    // Surprise, it's JSON for some reason!
                    gotJSON(scratchParseJSON(atob(text)));
                } else {
                    logMessage("Loaded .sb1.");
                    // Otherwise it should be an sb1.
                    window.gotZipBase64(content.split(',')[1]);
                    psuccess();
                }
            });
        }
    }).catch(perror);
}

function gotJSON(data){
    if (data.meta && data.meta.semver && data.meta.semver[0] === '3') {
        logMessage("It's an .sb3, we can't load it.");
        setProgress(100);
        alert("Sorry, that file was made or modified in Scratch 3.0, so we can't load it into 2.0.");
        animError();
        return;
    }

    setProgress(10);
    logMessage("Loaded JSON");
    project = data;
    processSoundsAndCostumes(project);
    if(project.hasOwnProperty("children")){
        for(child in project.children){
            processSoundsAndCostumes(project.children[child]);
        }
    }
    logMessage("Found "+totalAssets+" assets");
    downloadCostume();
}

function downloadCostume(){
    if(costumesToDownload.length > 0){
        var current = costumesToDownload.pop();
        logMessage("Loading asset "+current.costumeName+" ("+completeAssets+"/"+totalAssets+")");
        // For some reason sb2 projects all seem to have textLayerID be -1...
        // I'm not sure what the "right" way to deal with it is, but just setting it to a really
        // high, otherwise-unused but unique value works.
        current.textLayerID = getNewTextLayerID();
        return Promise.all([
            downloadCostumePart(current, current.baseLayerMD5, current.baseLayerID),
            downloadCostumePart(current, current.textLayerMD5, current.textLayerID)
        ]);
    } else {
        downloadSound();
    }
}

function getNewTextLayerID() {
    textLayerIDCounter++;
    return textLayerIDCounter;
}

function downloadCostumePart(current, md5, id) {
    // No md5 passed - don't do anything. This is the case when textLayerMD5 is not present.
    if (!md5) {
        return;
    }

    return fetch("https://cdn.assets.scratch.mit.edu/internalapi/asset/"+md5+"/get/").then(data => data.blob()).then(blob => {
        var reader = new FileReader();
        reader.onload = () => {
            var data = reader.result.split(',')[1];
            var ext = md5.match(/\.[a-zA-Z0-9]+/)[0];
            jszip.file(id+ext, data, {base64: true});
            completeAssets++;
            setProgress(10+89*(completeAssets/totalAssets));
            downloadCostume();
        };
        reader.readAsDataURL(blob);
    });
}

function downloadSound(){
    if(soundsToDownload.length > 0){
        var current = soundsToDownload.pop();
        logMessage("Loading asset "+current.soundName+" ("+completeAssets+"/"+totalAssets+")");
        fetch("https://cdn.assets.scratch.mit.edu/internalapi/asset/"+current.md5+"/get/").then(data => data.blob()).then(blob => {
            var reader = new FileReader();
            reader.onload = () => {
                var data = reader.result.split(',')[1];
                var ext = current.md5.match(/\.[a-zA-Z0-9]+/)[0];
                jszip.file(current.soundID+ext, data, {base64: true});
                completeAssets++;
                setProgress(10+89*(completeAssets/totalAssets));
                downloadSound();
            };
            reader.readAsDataURL(blob);
        });
    } else {
        jszip.file("project.json", JSON.stringify(project));
        logMessage("Generating ZIP...");
        var content = jszip.generate({type:"base64"});
        logMessage("Loading...");
        window.gotZipBase64(content);
        logMessage("Complete");
        psuccess();
    }
}

function processSoundsAndCostumes(node){
    if(node.hasOwnProperty("costumes")){
        for(var i=0;i<node.costumes.length;i++){
            var current = node.costumes[i];
            current.baseLayerID = costumeId;
            costumeId++;
            totalAssets++;
            costumesToDownload.push(current);
        }
    }
    if(node.hasOwnProperty("sounds")){
        for(var i=0;i<node.sounds.length;i++){
            var current = node.sounds[i];
            current.soundID = soundId;
            soundId++;
            totalAssets++;
            soundsToDownload.push(current);
        }
    }
}

function perror(err){
    console.error(err);
    alert("Failed to download. Perhaps you used a bad project ID?\nRemember that this tool only supports sb2 and sb1 projects.\n(It won't work if the project has been modified and saved in 3.0!)");
    logMessage("Download error");
    animError();
}

function animError() {
    setProgress(100);
    $("#progress").addClass("error");
    $("#progress").animate({opacity:0}, 1000, function(){
        $(this).css({"opacity":1, width:0});
    });
}

function psuccess(){
    setProgress(100);
    setTimeout(() => {
        $("#progress").addClass("success");
        $("#progress").animate({opacity:0}, 1000, function(){
            $(this).css({"opacity":1, width:0});
        });
    }, 100);
}

function setProgress(perc){
    maxWidth = $("#downloader").width();
    $("#progress").width(perc + '%');// * maxWidth * 1.055 / 100);
}

function logMessage(msg){
    $("#log").text(msg+"\n"+$("#log").text());
}
